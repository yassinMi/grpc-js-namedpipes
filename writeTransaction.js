
//@ts-check
const { default: ByteBuffer } = require("bytebuffer");
const net = require("net");
const protobuf  = require("protobufjs");
const { GrpcDotNetNamedPipes } = require("./proto/gen/messages");//generated with package protobufjs and protobufjs-cli

class WriteTransaction {


    constructor() {

    }

    /**
     * @type {Buffer}
     */
    buffer = Buffer.alloc(0)

    /**
     *  
     * @param {net.Socket} stream 
     */
    writeTo(stream) {

        //# writing transaction size


        let len = Buffer.alloc(4, 0);

        len.writeInt32LE(this.buffer.length)
        //# writing transaction data
        console.log("writing transaction length ", this.buffer.length)
        stream.write(len);
        
        console.log("writing transaction data ", this.buffer.toJSON())
        stream.write(this.buffer);
    }




    /**
    * 
    * @param {proto.GrpcDotNetNamedPipes.Generated.TransportMessage} tm 
    */
    addTransportMessage(tm) {
        var writer = new protobuf.BufferWriter()
        var serialized = tm.serializeBinary();
        var messageType = tm.hasHeaders()?"header":tm.hasPayloadInfo()?"pi":tm.hasRequestControl()?"rc":tm.hasRequestInit()?"ri":tm.hasTrailers()?"trailers":"unknown types"
        //console.log("writing delimited transport message (bytes) ",messageType,serialized.length)
        
        //writer.int32(serialized.length)
        //writer.bytes(serialized);
        var tm_obj = tm.toObject();
        if(tm_obj.requestControl===0) tm_obj.requestControl=undefined;//workaround multiple values issue
        console.log(tm_obj)
        var err = GrpcDotNetNamedPipes.Generated.TransportMessage.verify(tm_obj)
        if(err!==null){
            console.log(err);
            throw new Error(err);
        }
        let tm2 = GrpcDotNetNamedPipes.Generated.TransportMessage.fromObject(tm_obj)
        let newBuffer2 = GrpcDotNetNamedPipes.Generated.TransportMessage.encodeDelimited(tm2, writer)

        var newBuffer = writer.finish();
        this.buffer = Buffer.concat([this.buffer, newBuffer])
        return this;
    }

    /**
     *  
     * @param {Uint8Array} payload 
     */
    addPayloadWithLeadingPayloadInfo(payload) {

        let payloadInfo = new proto.GrpcDotNetNamedPipes.Generated.PayloadInfo();
        payloadInfo.setSize(payload.length);
        payloadInfo.setInSamePacket(true);
        var pi_tm = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
        pi_tm.setPayloadInfo(payloadInfo);
        this.addTransportMessage(pi_tm);
        this.buffer = Buffer.concat([this.buffer, payload])

        return this;

    }
}

exports.WriteTransaction = WriteTransaction;