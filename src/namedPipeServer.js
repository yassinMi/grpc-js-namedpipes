//@ts-check
const { ServerUnaryCallImpl } = require("@grpc/grpc-js/build/src/server-call");
const { ServerUnaryCall, ServerWritableStream } = require("grpc");
const grpc = require("grpc");
const net = require("net");
const protobuf = require("protobufjs");
const messagesTransport = require("./gen/transport_pb") //generated with package google-protobuf 
const GrpcDotNetNamedPipesMsgs = require("./gen/messages");//generated with package protobufjs and protobufjs-cli
const { EventEmitter } = require("stream");
const { status  } = require("@grpc/grpc-js");
const { WriteTransaction } = require("./writeTransaction");
const { StreamPacketsReader } = require("./streamPacketsReader");
const { ServerCallContext } = require("./callContext");
const {serviceRegistrationHandlerGrpc} = require("./serviceRegistrationHandlerGrpc")
const {serviceRegistrationHandlerGrpcJs} = require("./serviceRegistrationHandlerGrpcJs")
    /**
     * format-independent handelers internal to grpc-js-namedpipes
     * @module
     * @typedef  {(callContext:ServerCallContext)=>Promise<void>} InternalHandlerNP
     */

    /**
     * @module
     * @typedef {{[k in string]:InternalHandlerNP;}} InternalHandlersMapNP
     */

   /**
     * adds support for promise
     * @module
     * @template RequestType
     * @template ResponseType
     * @typedef {(call: ServerWritableStream<RequestType, ResponseType>) => void|Promise} handleServerStreamingCallNP
     */

     /**
     * adds support for promise
     * @module
     * @template RequestType
     * @template ResponseType
     * @typedef {(call: ServerUnaryCall<RequestType>, callback: grpc.sendUnaryData<ResponseType>) => void|Promise} handleUnaryCallNP
     */

      /**
     * determines how to populate the internal format-agnostic handlers map from an implementation of a specific format e.g grpc-js
     * @template TImplementation
     * @typedef {(internalHandlers:InternalHandlersMapNP,service:grpc.ServiceDefinition,impl:TImplementation)=>void} RegistrationHandler
     */


class NamedPipeServer {
    /**
     *  
     * @param {string?} pipeName_ 
     * if a pipeName is specified, the server will be created internally and no need to call bind after
     */
    constructor(pipeName_) {
        if (pipeName_) {
            this.pipeName = pipeName_;
            let pipeserver = net.createServer();
            this.bind(pipeserver);
        }
        else {

            this.pipeName=null;
        }
    }


    /**
     * 
     * @type {string?}
     * 
     */
    pipeName;
    /**
     * @type {net.Server}
     */
    pipeServer;

    /**
    * @param {net.Socket} stream
    * @returns {void}
    */
    handleConnection(stream) {
        this.currentCallContext = new ServerCallContext(this, stream)
        console.debug("Server: new connection");
    }

    /**
     * 
     * @param {net.Server} server 
     * @returns {void}
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
     * @type {InternalHandlersMapNP}
     */
    handlers = {};

    
    /**
     * not to be called directly by users, unless a custom RegistrationHandler is supplied
     * use addService or addServiceGrpcJs instead
     * @template TImplementation
     * @param {import('grpc').ServiceDefinition} service
     * @param {TImplementation} impl 
     * @param {RegistrationHandler<TImplementation>} registrationHandler 
     */
     registerAny(service, impl,registrationHandler){
        registrationHandler(this.handlers, service, impl);

    }

    /**
     * use this to register a service impl in the grpc format (data should be accesed with methods like call.request.getSomething())
     * @public
     * @param {import("grpc").ServiceDefinition} service 
     * @param {import("grpc").UntypedServiceImplementation} implementation 
     * @returns {void}
     */
    addService(service, implementation) {
        this.registerAny(service,implementation,/** @type {RegistrationHandler<import("grpc").UntypedServiceImplementation>} */(serviceRegistrationHandlerGrpc))
    }

    /**
     * use this to register a service impl in the grpc-js format (data should be accesed directly, like call.request.somthing)
     * @public
     * @param {import("grpc").ServiceDefinition} service //we still use grpc service definition -todo
     * @param {import("@grpc/grpc-js").UntypedServiceImplementation} implementation 
     * @returns {void}
     */
     addServiceGrpcJs(service, implementation) {
        this.registerAny(service,implementation,/** @type {RegistrationHandler<import("@grpc/grpc-js").UntypedServiceImplementation>} */(serviceRegistrationHandlerGrpcJs))
    }


    
}



exports.NamedPipeServer = NamedPipeServer;


