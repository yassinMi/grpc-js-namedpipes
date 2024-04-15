//@ts-check
const { expect } = require("chai")
const { NamedPipeServer } = require("../NamedPipeServer")
const { spawn } = require("child_process")
const path = require("path")
const { resolve } = require("path")
const jsTestService = require("./proto/gen/jsTestService_grpc_pb");
const testService = require("./proto/gen/TestService_grpc_pb");
const testServiceMessages = require("./proto/gen/TestService_pb");
const { startServer } = require("./utils")

const TEST_PIPE_MANE = "TEST_PIPE"

if (process.env.DOTNET_CLIENT_PATH === undefined || !process.env.DOTNET_CLIENT_PATH.toLowerCase().endsWith(".exe")) {
    throw new Error("DOTNET_CLIENT_PATH is not set or is invalid")
}

const DOTNET_CLIENT_PATH = process.env.DOTNET_CLIENT_PATH;

class TestServiceImpl {
    constructor() {
        this.exceptionToThrow = new Error('Test exception');
        this.simplyUnaryCalled = false;
        this.serverStream = null;
    }

    simpleUnary(call, callback) {
        console.log("simpleUnary impl invoked")
        this.simplyUnaryCalled = true;
        const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
        response.setValue(call.request.getValue());
        response.setBinary(call.request.getBinary());
        console.log("simpleUnary impl returning")
        callback(response);
    }

    delayedUnary(call, callback) {
        console.log("delayedUnary impl invoked")
        setTimeout(() => {
            const response = new proto.GrpcDotNetNamedPipes.Tests.Generated.ResponseMessage();
            callback(response);
        }, 2000);
    }

    throwingUnary(call, callback) {
        console.log("throwingUnary impl invoked")
        call.sendTrailers({ 'test_key': 'test_value' });
        callback(this.exceptionToThrow);
    }

    delayedThrowingUnary(call, callback) {
        console.log("delayedThrowingUnary impl invoked")
        setTimeout(() => {
            throw(this.exceptionToThrow);
        }, 2000);
    }
}

var testServiceImpl = new TestServiceImpl();
var smallMessage = "client123"
var largeMessage = "client123".repeat(10_000)

/**
 * invokes the dotnet client app which runs the test by test name
 * @param {string} testName 
 * @returns {Promise<void>}
 */
async function RunClientTestWithTestName(testName) {
    let server = new NamedPipeServer(TEST_PIPE_MANE)
    try {
        // @ts-ignore
        server.addService(testService.TestServiceService, testServiceImpl);
        await startServer(server);
        return await new Promise((resolve, reject) => {
            const child_proc = spawn(DOTNET_CLIENT_PATH, ["--client-test", "client123", testName])
            child_proc.on("exit", code => {
                if (code == 0) resolve();
                reject(`client exit code ${code}`)
            })
            child_proc.stdout.on('data', ( /** @type {string} */data) => {
                console.log("client: ", data.toString())
            });
        })
    }
    finally {
        if (server && server.pipeServer && server.pipeServer.listening)
            server.pipeServer.close();
    }



}

describe("Unary", (s) => {
    



    it("should handle simple unary call", async function () {
        this.timeout("10000")
        await RunClientTestWithTestName("SimpleUnary");
    })

    it("should handle large message", async function () {
        this.timeout("10000")
        await RunClientTestWithTestName("SimpleUnary-LargePayload");
    })

    it("should handle delayed call", async function () {
        this.timeout("10000")
        await RunClientTestWithTestName("DelayedUnary");
    })

    it("should handle delayed cancelled call", async function () {
        this.timeout("10000")
        await RunClientTestWithTestName("DelayedUnary-Cancelled");
    })

    it("should handle error", async function () {
        this.timeout("10000")
        await RunClientTestWithTestName("ThrowingUnary");

    })

})








