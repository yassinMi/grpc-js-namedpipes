const jspb = require("google-protobuf");

    /**
     *  
     * @param {jspb.BinaryWriteCallback} writer 
     * @param {any} message 
     * @returns {Uint8Array}
     */
    function serialize(marshaller,  message)
    {
        
        var serializationContext = new ByteArraySerializationContext();
        marshaller.ContextualSerializer(message, serializationContext);
        return serializationContext.SerializedData;
    }

     /**
     *  
     * @param {jspb.BinaryReadCallback} reader 
     * @param {Uint8Array} payload 
     * @returns {any}
     */
    function deserialize( reader, payload)
    {
        return jspb.Message.deserializeBinary(payload)
    }
