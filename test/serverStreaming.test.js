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


if (process.env.DOTNET_CLIENT_PATH === undefined || !process.env.DOTNET_CLIENT_PATH.toLowerCase().endsWith(".exe")) {
    throw new Error("DOTNET_CLIENT_PATH is not set or is invalid")
}


class TestServiceImpl {
    constructor() {
        this.exceptionToThrow = new Error('Test exception');
        this.simplyUnaryCalled = false;
        this.serverStream = null;
    }

    serverStreaming(call) {
        const request = call.request;
        for (let i = request.getValue(); i > 0; i--) {
            const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
            response.setValue(i);
            call.write(response);
        }
        call.end();
    }

    async delayedServerStreaming(call) {
        const request = call.request;
        for (let i = request.getValue(); i > 0; i--) {
            const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
            response.setValue(i);
            call.write(response);
            throw new Error("test failed")
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (call.cancelled) {
                break;
            }
        }
        call.end();
    }

    throwingServerStreaming(call) {
        const request = call.request;
        for (let i = request.getValue(); i > 0; i--) {
            const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
            response.setValue(i);
            call.write(response);
        }
        throw new Error("Exception was thrown by handler.");//because we propagate the error message, this string is necessary to pass the test
    }

}

var testServiceImpl = new TestServiceImpl();
var smallMessage = "client123"
var largeMessage = "client123".repeat(10_000)



describe("ServerStreaming", (s) => {

    it("should handle ServerStreaming call", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("ServerStreaming", testService.TestServiceService, testServiceImpl);
    })

    it("should handle DelayedServerStreaming-Cancelled call", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("DelayedServerStreaming-Cancelled", testService.TestServiceService, testServiceImpl);
    })

    it("should handle ThrowingServerStreaming", async function () {
        this.timeout("10000")
        await runClientTestWithTestName("ThrowingServerStreaming", testService.TestServiceService, testServiceImpl);

    })

})








