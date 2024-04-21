
//@ts-check
const net = require("net");
const protobuf  = require("protobufjs");
const { GrpcDotNetNamedPipes } = require("../src/gen/messages");//generated with package protobufjs and protobufjs-cli

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
        console.log(`writing delimited transport message (bytes=${serialized.length}) (type=${messageType}) `)
        
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
        if(tm_obj.trailers){
            tm_obj.trailers.metadata=tm_obj.trailers.metadataList;//workaround different conventions -todo
            delete tm_obj.trailers.metadataList
            if(Array.isArray(tm_obj.trailers.metadata)){
                //conversion of naming style 
                for (let i = 0; i < tm_obj.trailers.metadata.length; i++) {
                    const metadata = tm_obj.trailers.metadata[i];
                    metadata.valueString = metadata.valuestring;
                    //metadata.valueBytes = metadata.valuebytes; //causes multiple values error
                    delete metadata.valuestring;
                    delete metadata.valuebytes;
                    
                }
            }
        }
        console.log("tm_obj", JSON.stringify(tm_obj))
        let tm2_err = GrpcDotNetNamedPipes.Generated.TransportMessage.verify(tm_obj)
        if(tm2_err!==null){
            console.log("verify failed:",tm2_err);
            throw new Error(tm2_err);
        }
        let tm2 = GrpcDotNetNamedPipes.Generated.TransportMessage.fromObject(tm_obj)
        console.log("tm2",JSON.stringify(tm2))

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