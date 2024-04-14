
//@ts-check
const { default: ByteBuffer } = require("bytebuffer");
const net = require("net");
const protobuf  = require("protobufjs");
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
        console.log("writing rtransaction lenght ", this.buffer.length)
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
        console.log("writing transport message (bytes) ", serialized.length)
        writer.int32(serialized.length)
        writer.bytes(serialized);
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