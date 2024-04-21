//@ts-check
const { expect } = require("chai")
const { NamedPipeServer } = require("../src/namedPipeServer")
const { spawn } = require("child_process")
const path = require("path")
const { resolve } = require("path")
const jsTestService = require("./proto/gen/jsTestService_grpc_pb");
const testService = require("./proto/gen/TestService_grpc_pb");
const testServiceMessages = require("./proto/gen/TestService_pb");
const { startServer, runClientTestWithTestName } = require("./utils")
const { ServerWritableStream, ServerUnaryCall, Metadata, status } = require("grpc")


if (process.env.DOTNET_CLIENT_PATH === undefined || !process.env.DOTNET_CLIENT_PATH.toLowerCase().endsWith(".exe")) {
    throw new Error("DOTNET_CLIENT_PATH is not set or is invalid")
}


class TestServiceImpl {
    constructor() {
        var m = new Metadata()
        m.add('test_key', 'test_value')
        this.exceptionToThrow = {
            details: 'Exception was thrown by handler.',
            name: "invalid",
            message: "Exception was thrown by handler.",
            metadata: m
        };
        this.simplyUnaryCalled = false;
        this.serverStream = null;
    }
    /**
     * @type {import("grpc").ServiceError}
     */
    exceptionToThrow
    /**
     * 
     * @param {ServerUnaryCall} call 
     * @param {import("grpc").sendUnaryData<proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage>} callback 
     */
    simpleUnary(call, callback) {
        console.log("simpleUnary impl invoked")
        this.simplyUnaryCalled = true;
        const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
        response.setValue(call.request.getValue());
        response.setBinary(call.request.getBinary());
        console.log("simpleUnary impl returning")
        callback(null, response);
    }

    /**
     * 
     * @param {ServerUnaryCall} call 
     * @param {import("grpc").sendUnaryData<proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage>} callback 
     */
    delayedUnary(call, callback) {
        console.log("delayedUnary impl invoked")
        setTimeout(() => {
            const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
            callback(null, response);
        }, 2000);
    }

    /**
     * 
     * @param {ServerUnaryCall} call 
     * @param {import("grpc").sendUnaryData<proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage>} callback 
     */
    throwingUnary(call, callback) {
        console.log("throwingUnary impl invoked ", this.exceptionToThrow)

        callback(this.exceptionToThrow, null);
    }

    /**
     * 
     * @param {ServerUnaryCall} call 
     * @param {import("grpc").sendUnaryData<proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage>} callback 
     */
    delayedThrowingUnary(call, callback) {
        console.log("delayedThrowingUnary impl invoked")
        setTimeout(() => {
            callback(this.exceptionToThrow, null);
        }, 2000);
    }
}

var testServiceImpl = new TestServiceImpl();
var smallMessage = "client123"
var largeMessage = "client123".repeat(10_000)



describe("Unary", (s) => {

    it("should handle simple unary call", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("SimpleUnary", testService.TestServiceService, testServiceImpl);
    })

    it("should handle large message", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("SimpleUnary-LargePayload", testService.TestServiceService, testServiceImpl);
    })

    it("should handle delayed cancelled call", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("DelayedUnary-Cancelled", testService.TestServiceService, testServiceImpl);
    })

    it("should handle error", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("ThrowingUnary", testService.TestServiceService, testServiceImpl);

    })

    it("should handle error rpc", async function () {
        this.timeout("10000")
        testServiceImpl.exceptionToThrow.code = status.INVALID_ARGUMENT
        testServiceImpl.exceptionToThrow.details = "Bad arg";
        await runClientTestWithTestName("ThrowingUnary-Rpc", testService.TestServiceService, testServiceImpl);

    })

})








