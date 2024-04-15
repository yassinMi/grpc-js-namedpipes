//@ts-check
const { ServerUnaryCallImpl } = require("@grpc/grpc-js/build/src/server-call");
const { ServerUnaryCall } = require("grpc");
const grpc = require("grpc");
const net = require("net");
const protobuf = require("protobufjs");
const messagesTransport = require("./proto/gen/transport_pb") //generated with package google-protobuf 
const { GrpcDotNetNamedPipes } = require("./proto/gen/messages");//generated with package protobufjs and protobufjs-cli
const { EventEmitter } = require("stream");
const { status } = require("@grpc/grpc-js");
const { WriteTransaction } = require("./writeTransaction");
const { StreamPacketsReader } = require("./streamPacketsReader");


//@ts-check
class NamedPipeServer {
    /**
     *  
     * @param {string|undefined} pipeName 
     * if a pipeName is specified, the server will be created internally and no need to call bind after
     */
    constructor(pipeName) {
        if (pipeName) {
            this.pipeName = pipeName;
            let pipeserver = net.createServer();
            this.bind(pipeserver);

        }
        else {

        }


    }


    /**
     * @type {net.Server}
     */
    pipeServer;
    /**
     * @type {net.Socket}
     */
    current_socket;

    /**
     * @type {{path:string,deadline:Date}}
     */
    currentCall;
    /**
     * @param {net.Socket} stream
     */
    /**
     * @type {StreamPacketsReader}
     */
    packetsReader;
    handleConnection(stream) {
        console.debug("Server: new connection");
        this.packetsReader = new StreamPacketsReader();
        this.current_socket = stream;
        let payload;

        /**
         * @type {Buffer}
         */
        let currentRawPacket;
        let reader;//reads currentRawPacket and extracts parsed messages
        let expectingRemainingPayloadSize = 0;
        let len = -1;


        /**
                 * 
                 * @returns response or undefined (unimplmented)
                 */
        let generateResponse = async () => {
            let handeler = this.handlers[this.currentCall.path];
            if (handeler === undefined) {
                console.log("handeler not found for call: ", this.currentCall.path)

                return undefined
            }
            else {
                console.log("awaiting handeler  for call: ", this.currentCall.path)
                return await handeler(payload);
            }
        }
        let sendResponse = async (responseOrUnimplmented) => {
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
                    .writeTo(stream)
                stream.end();
            }
            else {
                console.log("sendResponse (ok)...")
                //is implemeted, generate and send reponse and close
                let trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
                trailers.setStatusCode(status.OK)
                let tm_trailers = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
                tm_trailers.setTrailers(trailers);

                new WriteTransaction().addPayloadWithLeadingPayloadInfo(responseOrUnimplmented)
                    .addTransportMessage(tm_trailers)
                    .writeTo(stream);
                stream.end();
            }

        }
        let sendError = async (errorString) => {
            console.log("sendEror ...")
            //write StatusCode.Unimplemented
            //and close
            let trailers = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
            trailers.setStatusCode(status.INTERNAL)
            trailers.setStatusDetail(errorString)
            let tm_trailers = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
            tm_trailers.setTrailers(trailers);
            new WriteTransaction().addTransportMessage(tm_trailers)
                .writeTo(stream)
            stream.end();
        }
        let handlePayload=async()=>{
            console.log("got payload: ", payload.toJSON())
            //# generate and send response (or unimplemented signal)
            console.log("generateResponse...")
            let implementationEror = null;
            try {
                var response = await generateResponse();
            } catch (error) {
                implementationEror = error?.message || error?.toString || "unknown";
            }

            console.log("sendResponse ...")
            try {
                if (implementationEror !== null)
                    await sendError(implementationEror);
                else
                    await sendResponse(response);
            }
            catch (err) {
                console.log("sendResponse failed: ", err)
            }

        }
        let checkPayloadCompleted = async () => {

            if (expectingRemainingPayloadSize == 0) {
                //end of payload reached
                await handlePayload();
            }
            else {
                console.log("expecting more payload bytes: ", expectingRemainingPayloadSize)
            }
        }
        let hndlTranportMessage = async (tm) => {
            if (tm.payloadInfo) {
                if (expectingRemainingPayloadSize > 0) {
                    throw new Error("unexpected payload info while another payload is partially recieved")
                }
                payload = Buffer.alloc(0);

                expectingRemainingPayloadSize = tm.payloadInfo.size;
                if (tm.payloadInfo.isSamePacket) {
                    //throw new Error("not in same packet is not supported")
                    let payloaChuck = currentRawPacket.subarray(reader.pos, Math.min(currentRawPacket.length, reader.pos + tm.payloadInfo.size));
                    reader.skip(payloaChuck.length);
                    payload = Buffer.concat([payload, payloaChuck]);
                    expectingRemainingPayloadSize -= payloaChuck.length;
                    checkPayloadCompleted();
                }
                else{
                    this.packetsReader.expectPayload=tm.payloadInfo.size;

                }

                



            }
            else if (tm.requestInit) {
                this.currentCall = { path: tm.requestInit.methodFullName, deadline: tm.requestInit.deadline }
                console.log("recieved requestInit, current call: ", this.currentCall)
            }
            else if (tm.trailers) {

                console.log("recieved trailers ", tm.trailers)
            }
        }

        this.packetsReader.handleMessage=async(rawPacket)=>
            {
                currentRawPacket = rawPacket;
                if (rawPacket.length > 0) {
                    console.log("parsing packet of length ", rawPacket.length);
                }
                else {
                    console.log("recieved empty packet", rawPacket.length);
                }
                reader = new protobuf.BufferReader(rawPacket)
                let read_tm_count = 0
                while (true) {
                    if (expectingRemainingPayloadSize > 0) {
                        var payLoadReadBytes = Math.min(expectingRemainingPayloadSize, reader.len - reader.pos);
                        let payloaChuck = rawPacket.subarray(reader.pos, Math.min(rawPacket.length, reader.pos + payLoadReadBytes));
                        reader.skip(payLoadReadBytes);
                        payload = Buffer.concat([payload, payloaChuck]);
                        expectingRemainingPayloadSize -= payLoadReadBytes;
                        checkPayloadCompleted();
                    }
                    let tm = GrpcDotNetNamedPipes.Generated.TransportMessage.decodeDelimited(reader);
                    console.log("read tm: ", tm)
                    read_tm_count++;
                    try {
                        await hndlTranportMessage(tm)
                    } catch (error) {
                        await sendError(error.message)
                    }
                    if (reader.pos < reader.len) {
                        let left = reader.len - reader.pos;
                        console.log("left bytes: ", left)
                    }
                    else {
                        break;
                    }
                }
            }
            this.packetsReader.handlePayload=async (readerObtainedPayload)=>{

                payload = readerObtainedPayload;
                await handlePayload();
            }
        stream.on("data", async (buffer) => {
            console.log("raw data: ( "+buffer.length.toString()+")", buffer.toJSON());



            this.packetsReader.write(buffer);
            
            



            //let user_json = JSON.parse(user_data);




            //var m = new  proto.GrpcDotNetNamedPipes.Generated.TransportMessage()
            //var red = new jspb.BinaryReader(buffer.buffer,0,buffer.readInt32LE(0));
            //proto.GrpcDotNetNamedPipes.Generated.TransportMessage.deserializeBinaryFromReader(m,red)

            //console.log(m.getRequestInit().getMethodfullname())

            /*stream.write("respone string",(err)=>{
                console.log("written with error:",err);
            })*/
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
     * 
     * @param {net.Server} server 
     */
    bind(server) {

        if (this.pipeServer) {
            throw new Error("a pipe server already exists");
        }
        this.pipeServer = server;
        this.pipeServer.on("connection", (stream) => {
            this.handleConnection(stream)
        })
    }

    /**
     * 
     * @param {(err)=>void} callback 
     */
    start(callback) {
        if (!this.pipeName) {
            callback("this method should only be used when creating the server with a pipe name")
            return;
        }
        if (Object.keys(this.handlers).length === 0) {
            callback("one or more service methods must be registered")
            return;
        }
        if (this.pipeServer) {
            if (this.pipeServer.listening) {
                callback("server already listening")
                return;
            }
            else {
                try {
                    this.pipeServer.listen(`\\\\.\\pipe\\${this.pipeName}`, (err) => {
                        console.log("listen cb");
                        callback(err);
                    });
                } catch (error) {
                    callback(error);
                }

            }
        }
    }
    /**
     * @type {{[k in string]:(request:Buffer)=>Promise<Buffer>;}}
     */
    handlers = {};

    /**
     * 
     * @param {import("grpc").ServiceDefinition} service 
     * @param {import("grpc").UntypedServiceImplementation} implementation 
     * @returns {void}
     */
    addService(service, implementation) {
        Object.keys(service).forEach(key => {
            let def = service[key]
            let implementationMethod = implementation[key] || implementation[def.path] || undefined;

            if (implementationMethod !== undefined) {
                console.log("refistering service call ", def.path)

                this.handlers[def.path] = (request) => {

                    return new Promise((resolve, reject) => {

                        var parsed = def.requestDeserialize(request);
                        let call = {
                            request: parsed,
                            cancelled: null,
                            getPeer: null,
                            sendMetadata: null
                        }

                        let callback = (response) => {
                            console.log("implementer returned reqponse ", response)
                            var responsebytes = def.responseSerialize(response);
                            console.log("reqponse serialized ", responsebytes.length)
                            console.log("responding with response bytes ", responsebytes.toJSON())
                            resolve(responsebytes);
                        }


                        console.log("calling impl with request parsed ", call.request)
                        // @ts-ignore
                        let res = implementationMethod.call(implementation, call, callback)


                    })


                }

            }
            else {
                console.log("registering service method not implemented")


            }
        })
    }


}



exports.NamedPipeServer = NamedPipeServer;