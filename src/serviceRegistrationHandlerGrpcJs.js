//@ts-check
const grpc = require("@grpc/grpc-js");
const { WriteTransaction } = require("./writeTransaction");
const { status, Metadata } = require("@grpc/grpc-js");
const { EventEmitter } = require("stream");
const { Writable } = require("stream");
const { ServerCallContext } = require("./callContext");
const { Status } = require("@grpc/grpc-js/build/src/constants");
const { methodTypes } = require("grpc");





/**
 * @template TRequest
 * @template TResponse
 * @implements {grpc.ServerUnaryCall<TRequest,TResponse>}
 */
 class ServerUnaryCallNP extends EventEmitter  {

    /**
     *  
     * @param {ServerCallContext} callContext 
     */
    constructor(callContext) {
        super();
        this.metadata= new grpc.Metadata();
        this.callContext=callContext
    }
    /**
     * @type {ServerCallContext}
     */
    callContext
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
     * @readonly
     */
    metadata;

    /**
     * @type {(responseMetadata: Metadata)=> void}
     */
    sendMetadata(responseMetadata){
        new WriteTransaction()
        //todo
    }
    /**
     * @type {()=>string}
     */
    getPeer(){
        return "NA"
    }

    /**
     * @returns {import("@grpc/grpc-js").Deadline}
     */
    getDeadline(){

        return 

    };


    /**
     * 
     * @returns {string}
     */
    getPath = ()=>""
    
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
    // @ts-ignore
    write(chunk, cb) {


        var bytes = this.def.responseSerialize(chunk)
        new WriteTransaction()
            .addPayloadWithLeadingPayloadInfo(bytes)
            .writeTo(this.callContext.current_socket);
        return true
    }
    // @ts-ignore
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


/**
 * helps integrating service implementation formats (grpc-js) 
 * @param {import("./namedPipeServer").InternalHandlersMapNP} handlersInternal
 * @param {import("@grpc/grpc-js").UntypedServiceImplementation} implementation
 * @param {import("grpc").ServiceDefinition} service
 * @returns {void}
 */
function serviceRegistrationHandlerGrpcJs(handlersInternal, service, implementation) {

    if(!implementation){
        throw new Error("the implementation specified is null")
    }
    Object.keys(service).forEach(key => {
        let def = service[key]
        let implementationMethod = implementation[key] || implementation[def.path] || undefined;
        if (implementationMethod !== undefined) {
            implementationMethod = implementationMethod.bind(implementation);
            console.log("registering service call (grpc-js)", def.path)
            var callType = methodTypes.UNARY;
            if (def.responseStream) {
                callType = def.requestStream ? methodTypes.BIDI_STREAMING : methodTypes.SERVER_STREAMING
            }
            else {
                callType = def.requestStream ? methodTypes.CLIENT_STREAMING : methodTypes.UNARY
            }
            switch (callType) {
                case methodTypes.UNARY:
                    handlersInternal[def.path] = _createUnaryHandler(def, /** @type {import("@grpc/grpc-js").handleUnaryCall<any,any>} */(implementationMethod) )
                    break;
                case methodTypes.SERVER_STREAMING:
                    handlersInternal[def.path] = _createServerStreamingHandler(def, /** @type {import("@grpc/grpc-js").handleServerStreamingCall<any,any>} */(implementationMethod))
                    break;
            }
        }
        else {
            console.log("registering call (grpc): not implemented, skiped")
        }
    })


}


/**
     * @template TRequest
     * @template TResponse
     * @param {grpc.MethodDefinition<TRequest,TResponse>} def 
     * @param {import("@grpc/grpc-js").handleUnaryCall<TRequest,TResponse>} implementationMethod 
     * @returns {import("./namedPipeServer").InternalHandlerNP}
     */
function _createUnaryHandler(def, implementationMethod) {
    return (callContext) => {
        return new Promise((resolve, reject) => {
            var parsed = def.requestDeserialize(callContext.payload);
            /**
             * @type {grpc.ServerUnaryCall<TRequest,TResponse>}
             */
            let call = new ServerUnaryCallNP(callContext);
            call.request = parsed;
            call.cancelled = false;
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
                            /**
                             * @type {proto.GrpcDotNetNamedPipes.Generated.MetadataEntry[]}
                             */
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
                            console.log('including trilers in response',JSON.stringify(md_list))
                            trailers_tm.setMetadataList(md_list);

                        }
                        trailers_tm.setStatusCode(error.code || status.UNKNOWN);
                        trailers_tm.setStatusDetail(error.details)
                        trailers_tm_w.setTrailers(trailers_tm)

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
            
            var res = implementationMethod(call, callback)
            // @ts-ignore
            if (res instanceof Promise) {
                console.log("fn " + def.path + " returns a promise!")
                res
                    .then(() => {
                        console.log("impl promise resolved")
                        resolve();
                    })
                    .catch((err) => {
                        console.log("impl promise rejected ", err)
                        reject(err);//this will cause an internal error
                    })
            }

        })
    }
}


/**
 * @private
 * @template TRequest
 * @template TResponse
 * @param {grpc.MethodDefinition<TRequest,TResponse>} def 
 * @param {import("grpc").handleServerStreamingCall<TRequest,TResponse>} implementationMethod 
 * @returns {import("./namedPipeServer").InternalHandlerNP}
 */
function _createServerStreamingHandler(def, implementationMethod) {
    return (callContext) => {
        return new Promise((resolve, reject) => {
            var parsed = def.requestDeserialize(callContext.payload);
            /**
             * @type {import("@grpc/grpc-js").ServerWritableStream<TRequest,TResponse>}
             */
            // @ts-ignore
            let call = new ServerWritableStreamNP(callContext, def);
            call.request = parsed;
            call.cancelled = false;

            console.log("calling impl with writeable stream  ", call.request)
            try {
                var res = implementationMethod(call)
            } catch (error) {
                if(error instanceof Error){
                    callContext.sendError(Status.UNKNOWN,error.message)
                }
            }
            
            // @ts-ignore
            if (res instanceof Promise) {
                console.log("fn " + def.path + " returns a promise!")
                res.then(resolve)
                    .catch(reject)
            }
        })
    }
}

exports.serviceRegistrationHandlerGrpcJs = serviceRegistrationHandlerGrpcJs;