//@ts-check
const { ServerUnaryCallImpl } = require("@grpc/grpc-js/build/src/server-call");
const { ServerUnaryCall } = require("grpc");
const grpc = require("grpc");
const net = require("net");
const protobuf = require("protobufjs");
const messagesTransport = require("./transport_pb") //generated with package google-protobuf 
const { GrpcDotNetNamedPipes } = require("./transport-proto");//generated with package protobufjs and protobufjs-cli
const { EventEmitter } = require("stream");


//@ts-check
class NamedPipeServer {
    /**
     *  
     * @param {string|undefined} pipeName 
     * if a pipeName is specified, the server will be created internally and no need to call bind after
     */
    constructor(pipeName) {
        if(pipeName){
            this.pipeName = pipeName;
            let pipeserver = net.createServer();
            this.bind(pipeserver);
    
        }
        else{

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
    handleConnection(stream){
        console.debug("Server: new connection");
        this.current_socket = stream;
        let expectingLength = true;
        let len = -1;
        stream.on("data", async(buffer) => {

            console.log("raw data: ", buffer.toJSON());

            if (expectingLength) {
                expectingLength = false;
                console.log("parsing length");
                len = buffer.readInt32LE(0);
                console.log("parsed length: ", len);

            }
            else {
                if (len > 0)
                    console.log("parsing message of length ", len);

                let messageBytes = buffer;
                if (messageBytes.length != len) {
                    throw new Error(`expected len ${len} , got ${messageBytes.length}`)
                }
                //old impl using google-protobuf
                /*
                let m = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
                var [msgLen, msgLenLen] = readVarInt(buffer);
                var reader = new jspb.BinaryReader(buffer.buffer,msgLenLen,msgLen);
                proto.GrpcDotNetNamedPipes.Generated.TransportMessage.deserializeBinaryFromReader(m,reader)
                console.log(m.getRequestInit().getMethodfullname())
                */
                var reader = new protobuf.BufferReader(buffer)


                let read_tm_count = 0
                let payload;
                let hndlTranportMessage =async (tm)=>{
                    if (tm.payloadInfo) {
                        payload = buffer.subarray(reader.pos, reader.pos + tm.payloadInfo.size);
                        reader.skip(tm.payloadInfo.size);
                        console.log("got payload: ", payload.toJSON())
                        console.log(", current call: ",this.currentCall)
                        var response = await this.handlers[this.currentCall.path](payload);
                        stream.write(response);
                    }
                    else if(tm.requestInit){
                        this.currentCall={path:tm.requestInit.methodFullName,deadline:tm.requestInit.deadline}
                        console.log("recieved requestInit, current call: ",this.currentCall)
                    }
                    else if(tm.trailers){
                        
                    }
                }
                
                while (true) {
                    let tm = GrpcDotNetNamedPipes.Generated.TransportMessage.decodeDelimited(reader);

                    console.log("read tm: ", tm)
                    read_tm_count++;
                    await hndlTranportMessage(tm)
                   

                    if (reader.pos < reader.len) {
                        let left = reader.len - reader.pos;
                        console.log("left bytes: ", left)
                    }
                    else {
                        break;
                    }
                }



            }
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

        if(this.pipeServer){
            throw new Error("a pipe server already exists");
        }
        this.pipeServer = server;
        this.pipeServer.on("connection",(stream)=>{
            this.handleConnection(stream)
        })
    }

    /**
     * 
     * @param {(err)=>void} callback 
     */
    start(callback) {
        if(!this.pipeName){
            throw new Error("this method should only be used when creating the server with a pipe name")
        }
        if(Object.keys(this.handlers).length===0){
            throw new Error("one or more service methods must be registered")
        }
        if(this.pipeServer){
            if(this.pipeServer.listening){
                throw new Error("server already listening")
            }
            else{
                
                this.pipeServer.listen(`\\\\.\\pipe\\${this.pipeName}`, (err) => {
                    console.log("listen cb");
                    callback(err);
                });
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
            let implementationMethod =implementation[key]||implementation[def.path]||undefined ;

            if (implementationMethod!==undefined) {
                console.log("refistering service call ", def.path)

                this.handlers[def.path] = (request) => {

                    return new Promise((resolve,reject)=>{

                        var parsed = def.requestDeserialize(request);
                        let call = {
                            request: parsed,
                            cancelled:null,
                            getPeer:null,
                            sendMetadata:null
                        }
    
                        let callback=(response)=>{
                            console.log("implementer returned reqponse ", response)
                            var responsebytes = def.responseSerialize(response);
                            console.log("reqponse serialized ", responsebytes.length)
                            console.log("responding with response bytes ", responsebytes.toJSON())
                            resolve(responsebytes);
                        }
    

                        console.log("calling impl with request parsed ", call.request)
                        // @ts-ignore
                        implementationMethod(call,callback)
                        
                        
                        
                    })
                    

                }

            }
            else{
                console.log("registering service method not implemented")

                this.handlers[def.path] = async (request) => {



                    console.log("service method not implemented")
                    throw new Error("service method not implemented")
                    //todo send the not implemented information
                }
            }
        })
    }


}


exports.NamedPipeServer = NamedPipeServer;