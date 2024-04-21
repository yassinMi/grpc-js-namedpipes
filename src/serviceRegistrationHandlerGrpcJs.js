//@ts-check

/**
 * helps integrating service implementation formats (grpc-js) 
 * @param {import("./namedPipeServer").InternalHandlersMapNP} handlersInternal
 * @param {import("@grpc/grpc-js").UntypedServiceImplementation} implementation
 * @param {import("grpc").ServiceDefinition} service
 * @returns {void}
 */
function serviceRegistrationHandlerGrpcJs(handlersInternal,service, implementation) {

    //todo



}

exports.serviceRegistrationHandlerGrpcJs = serviceRegistrationHandlerGrpcJs;