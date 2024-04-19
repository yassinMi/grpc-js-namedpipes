//@ts-check
const net = require("net")
const protobuf = require("protobufjs");
const { Writable } = require("stream");
const messagesTransport = require("./proto/gen/transport_pb") //generated with package google-protobuf 
const { GrpcDotNetNamedPipes } = require("./proto/gen/messages");//generated with package protobufjs and protobufjs-cli
const { EventEmitter } = require("stream");
const { status, Metadata } = require("@grpc/grpc-js");
const { WriteTransaction } = require("./writeTransaction");
const { StreamPacketsReader } = require("./streamPacketsReader");
const { NamedPipeServer } = require("./NamedPipeServer");

class ServerCallContext {
    /**
     * 
     * @param {net.Socket} stream 
     * @param {NamedPipeServer} owner 
     */
    constructor(owner, stream) {

        this.owner = owner;
        this.current_socket = stream;
        this.packetsReader = new StreamPacketsReader();
        this.packetsReader.handleMessage = this.packetsReader_handleMessage;
        this.packetsReader.handlePayload = this.packetsReader_handlePayload;
        this.clientRequest = undefined;
        stream.on("data", async (buffer) => {
            //console.log("raw data: (" + buffer.length.toString() + ")", buffer.toJSON());
            this.packetsReader.write(buffer);
        });

        stream.on("end", () => {
            console.log("Stream ended");
        });
        stream.on("close", () => {
            console.log("Stream close");
        })
        stream.on("drain", () => {
            console.log("Stream drain");
        })
        stream.on("connect", () => {
            console.log("Stream connect");
        })
    }
    /**
     * @type {Buffer}
     */
    payload;

    /**
     * @type {Buffer}
     */
    currentRawPacket;
    reader;//reads currentRawPacket and extracts parsed messages
    expectingRemainingPayloadSize = 0;
    len = -1;


    /**
    * @type {StreamPacketsReader}
    */
    packetsReader;
    /**
     * @type {net.Socket}
     */
    current_socket;
    /**
        * @type {{path:string,deadline:Date}}
        */
    currentCall;


    sendResponse = async (responseOrUnimplmented) => {
        //# handeling call and writing response
        if (responseOrUnimplmented === undefined) {
            console.log("sendResponse (UNIMPLEMENTED)...")
            //write StatusCode.Unimplemented
            //and close
            let trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
            trailers.setStatusCode(status.UNIMPLEMENTED)
            let tm_trailers = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
            tm_trailers.setTrailers(trailers);
            new WriteTransaction().addTransportMessage(tm_trailers)
                .writeTo(this.current_socket)
            this.current_socket.end();
        }
        else {
            //console.log("sendResponse (ok)...")
            //is implemeted, generate and send reponse and close
            let trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
            trailers.setStatusCode(status.OK)
            let tm_trailers = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
            tm_trailers.setTrailers(trailers);

            new WriteTransaction().addPayloadWithLeadingPayloadInfo(responseOrUnimplmented)
                .addTransportMessage(tm_trailers)
                .writeTo(this.current_socket);
            this.current_socket.end();
        }

    }
    /**
     * 
     * @param {status} statusCode 
     * @param {string} errorString 
     */
    async sendError(statusCode, errorString) {
        console.log("sendEror ...")
        //write StatusCode.Unimplemented
        //and close
        let trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
        trailers.setStatusCode(statusCode)
        trailers.setStatusDetail(errorString)
        let tm_trailers = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
        tm_trailers.setTrailers(trailers);
        new WriteTransaction().addTransportMessage(tm_trailers)
            .writeTo(this.current_socket)
        this.current_socket.end();
    }
    handlePayload = async () => {
        //console.log("handeling payload: ", this.payload.toJSON())
        //# generate and send response (or unimplemented signal)
        console.log("generateResponse...")
        let implementationEror = null;

        let handeler = this.owner.handlers[this.currentCall.path];
        if (handeler === undefined) {
            console.log("handeler not found for call: ", this.currentCall.path)
            this.sendError(status.UNIMPLEMENTED, "method" + this.currentCall.path + " is unimplemented")
        }
        else {
            try {
                console.log("awaiting handeler  for call: ", this.currentCall.path)
                await handeler(this);
            } catch (error) {
                implementationEror = error?.message ?? "unknown";
            }
        }

        try {
            if (implementationEror !== null)
                await this.sendError(status.UNKNOWN, implementationEror);
        }
        catch (err) {
            console.log("sendResponse failed: ", err)
        }

    }
    checkPayloadCompleted = async () => {

        if (this.expectingRemainingPayloadSize == 0) {
            //end of payload reached
            await this.handlePayload();
        }
        else {
            // console.log("expecting more payload bytes: ", this.expectingRemainingPayloadSize)
        }
    }
    hndlTranportMessage = async (tm) => {
        if (tm.payloadInfo) {
            if (this.expectingRemainingPayloadSize > 0) {
                throw new Error("unexpected payload info while another payload is partially recieved")
            }
            this.payload = Buffer.alloc(0);
            this.expectingRemainingPayloadSize = tm.payloadInfo.size;
            if (tm.payloadInfo.isSamePacket) {
                //throw new Error("not in same packet is not supported")
                let payloaChuck = this.currentRawPacket.subarray(this.reader.pos, Math.min(this.currentRawPacket.length, this.reader.pos + tm.payloadInfo.size));
                this.reader.skip(payloaChuck.length);
                this.payload = Buffer.concat([this.payload, payloaChuck]);
                this.expectingRemainingPayloadSize -= payloaChuck.length;
                this.checkPayloadCompleted();//todo: we probably don't need this check if inSamePacket means the full payload is included
            }
            else {
                //making the reader handle payload reading internally, since it's not delimited with size
                this.packetsReader.expectPayload = tm.payloadInfo.size;
            }
        }
        else if (tm.requestInit) {
            this.currentCall = { path: tm.requestInit.methodFullName, deadline: tm.requestInit.deadline }
            //console.log("recieved requestInit, current call: ", this.currentCall)
        }
        else if (tm.trailers) {
            //console.log("recieved trailers ", tm.trailers)
        }
    }

    packetsReader_handleMessage = async (rawPacket) => {
        this.currentRawPacket = rawPacket;
        if (rawPacket.length > 0) {
            //console.log("parsing packet of length ", rawPacket.length);
        }
        else {
            //console.log("recieved empty packet", rawPacket.length);
        }
        this.reader = new protobuf.BufferReader(rawPacket)
        let read_tm_count = 0
        while (true) {
            if (this.expectingRemainingPayloadSize > 0) {
                var payLoadReadBytes = Math.min(this.expectingRemainingPayloadSize, this.reader.len - this.reader.pos);
                let payloaChuck = rawPacket.subarray(this.reader.pos, Math.min(rawPacket.length, this.reader.pos + payLoadReadBytes));
                this.reader.skip(payLoadReadBytes);
                this.payload = Buffer.concat([this.payload, payloaChuck]);
                this.expectingRemainingPayloadSize -= payLoadReadBytes;
                this.checkPayloadCompleted();
            }
            let tm = GrpcDotNetNamedPipes.Generated.TransportMessage.decodeDelimited(this.reader);
            //console.log("read tm: ", tm)
            read_tm_count++;
            try {
                await this.hndlTranportMessage(tm)
            } catch (error) {
                await this.sendError(status.INTERNAL, error.message)
            }
            if (this.reader.pos < this.reader.len) {
                let left = this.reader.len - this.reader.pos;
            }
            else {
                break;
            }
        }
    }
    packetsReader_handlePayload = async (readerObtainedPayload) => {
        this.payload = readerObtainedPayload;//todo: simplify the flow and remove state variables
        await this.handlePayload();
    }

}




/**
 * @template TRequest
 */
class ServerUnaryCallNP extends EventEmitter {

    constructor() {

        super();
    }
    /**
     * @type {TRequest}
     */
    request
    /**
     * @type {boolean}
     */
    cancelled
    /**
     * @type {Metadata}
     */
    metadata
    sendMetadata(metadata) {
    }
    getPeer() {
        return "NA"
    }
}


/**
 * @template TRequest
 */
class ServerWritableStreamNP extends Writable {

    /**
     * @param {ServerCallContext} callContext
     * @param {import("grpc").MethodDefinition} def
     */
    constructor(callContext, def) {

        super();
        this.callContext = callContext

        this.def = def;
    }
    /**
    * @type {ServerCallContext} 
    */
    callContext;
    /**
     * 
     * @param {any} chunk 
     * @param {({(er:Error|null|undefined):void})|undefined} cb
     * @returns {boolean}
     */
    write(chunk, cb) {


        var bytes = this.def.responseSerialize(chunk)
        new WriteTransaction()
            .addPayloadWithLeadingPayloadInfo(bytes)
            .writeTo(this.callContext.current_socket);
        return true
    }
    end() {
        var msg = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
        var trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
        trailers.setStatusCode(0);
        trailers.setStatusDetail("");

        msg.setTrailers(trailers);
        new WriteTransaction()
            .addTransportMessage(msg)
            .writeTo(this.callContext.current_socket);
        // this.callContext.current_socket.end()
    }
    /**
     * @type {TRequest}
     */
    request
    /**
     * @type {boolean}
     */
    cancelled
    /**
     * @type {Metadata}
     */
    metadata
    sendMetadata(metadata) {
    }
    getPeer() {
        return "NA"
    }
}

exports.ServerUnaryCallNP = ServerUnaryCallNP
exports.ServerWritableStreamNP = ServerWritableStreamNP
exports.ServerCallContext = ServerCallContext