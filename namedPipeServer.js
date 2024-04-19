//@ts-check
const { ServerUnaryCallImpl } = require("@grpc/grpc-js/build/src/server-call");
const { ServerUnaryCall, ServerWritableStream } = require("grpc");
const grpc = require("grpc");
const net = require("net");
const protobuf = require("protobufjs");
const messagesTransport = require("./proto/gen/transport_pb") //generated with package google-protobuf 
const { GrpcDotNetNamedPipes } = require("./proto/gen/messages");//generated with package protobufjs and protobufjs-cli
const { EventEmitter } = require("stream");
const { status } = require("@grpc/grpc-js");
const { WriteTransaction } = require("./writeTransaction");
const { StreamPacketsReader } = require("./streamPacketsReader");
const { ServerUnaryCallNP, ServerCallContext, ServerWritableStreamNP } = require("./callContext");


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
    * @param {net.Socket} stream
    */
    handleConnection(stream) {
        this.currentCallContext = new ServerCallContext(this, stream)
        console.debug("Server: new connection");
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
     * @typedef  {(callContext:ServerCallContext)=>Promise<void>} HandlerNP
     */

    /**
     * @type {{[k in string]:HandlerNP;}}
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
                implementationMethod = implementationMethod.bind(implementation);
                console.log("refistering service call ", def.path)
                var callType = grpc.methodTypes.UNARY;
                if (def.responseStream) {
                    callType = def.requestStream ? grpc.methodTypes.BIDI_STREAMING : grpc.methodTypes.SERVER_STREAMING
                }
                else {
                    callType = def.requestStream ? grpc.methodTypes.CLIENT_STREAMING : grpc.methodTypes.UNARY
                }
                switch (callType) {
                    case grpc.methodTypes.UNARY:
                        // @ts-ignore
                        this.handlers[def.path] = this._createUnaryHandler(def, implementationMethod)
                        break;
                    case grpc.methodTypes.SERVER_STREAMING:
                        // @ts-ignore
                        this.handlers[def.path] = this._createServerStreamingHandler(def, implementationMethod)
                        break;
                }

            }
            else {
                console.log("registering service method not implemented")
            }
        })
    }

    /**
     * @template TRequest
     * @template TResponse
     * @param {grpc.MethodDefinition<TRequest,TResponse>} def 
     * @param {grpc.handleUnaryCall<TRequest,TResponse>} implementationMethod 
     * @returns {HandlerNP}
     */
    _createUnaryHandler(def, implementationMethod) {
        return (callContext) => {
            return new Promise((resolve, reject) => {
                var parsed = def.requestDeserialize(callContext.payload);
                /**
                 * @type {ServerUnaryCall}
                 */
                let call = new ServerUnaryCallNP();
                call.request = parsed;
                call.cancelled = false;
                call.metadata = new grpc.Metadata();
                /**
                 * 
                 * @type {grpc.sendUnaryData<TResponse>} 
                 */
                let callback = (error, response, trailers, flags) => {
                    console.log("err provided", error)

                    if (error === null && response !== null) {
                        var responsebytes = def.responseSerialize(response);
                        callContext.sendResponse(responsebytes)
                        resolve();
                    }
                    else if (error !== null && response === null) {
                        if (trailers === undefined)
                            trailers = error.metadata;
                        if ((trailers !== undefined) || (error.code !== undefined) || (error.details !== undefined)) {
                            var trailers_tm_w = new proto.GrpcDotNetNamedPipes.Generated.TransportMessage();
                            var trailers_tm = new proto.GrpcDotNetNamedPipes.Generated.Trailers();
                            if (trailers !== undefined) {
                                var md_list = []
                                var map = JSON.parse(JSON.stringify(trailers.getMap()))
                                Object.keys(map).forEach((k) => {
                                    var val = map[k]
                                    if (val === undefined) return;
                                    var entry = new proto.GrpcDotNetNamedPipes.Generated.MetadataEntry()
                                    entry.setName(k)
                                    if (typeof val === "string")
                                        entry.setValuestring(val);
                                    else if (Buffer.isBuffer(val)) {
                                        entry.setValuebytes(val);
                                    }
                                    else {
                                        console.log("unknown entry type")
                                        return
                                    }

                                    md_list.push(entry)
                                })
                                trailers_tm.setMetadataList(md_list);

                                trailers_tm_w.setTrailers(trailers_tm)
                            }
                            trailers_tm.setStatusCode(error.code || status.UNKNOWN);
                            trailers_tm.setStatusDetail(error.details)
                            new WriteTransaction()
                                .addTransportMessage(trailers_tm_w)
                                .writeTo(callContext.current_socket)
                        }
                        else {
                            reject(error)//handles a simple error case with UNKNOWN
                        }

                    }
                }
                console.log("calling impl with request parsed ", call.request)
                // @ts-ignore
                var res = implementationMethod(call, callback)
                if (res instanceof Promise) {
                    res.then(resolve)
                        .catch(reject)
                }

            })
        }
    }


    /**
     * @template TRequest
     * @template TResponse
     * @param {grpc.MethodDefinition<TRequest,TResponse>} def 
     * @param {grpc.handleServerStreamingCall<TRequest,TResponse>} implementationMethod 
     * @returns {HandlerNP}
     */
    _createServerStreamingHandler(def, implementationMethod) {
        return (callContext) => {
            return new Promise((resolve, reject) => {
                var parsed = def.requestDeserialize(callContext.payload);
                /**
                 * @type {ServerWritableStream}
                 */
                let call = new ServerWritableStreamNP(callContext, def);
                call.request = parsed;
                call.cancelled = false;
                call.metadata = new grpc.Metadata();

                console.log("calling impl with writeable stream  ", call.request)
                // @ts-ignore
                var res = implementationMethod(call)
                if (res instanceof Promise) {
                    console.log("fun " + def.path + " is async")
                    res.then(resolve)
                        .catch(reject)
                }
            })
        }
    }
}



exports.NamedPipeServer = NamedPipeServer;


