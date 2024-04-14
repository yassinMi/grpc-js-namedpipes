//@ts-check
const { expect } = require("chai")
const { NamedPipeServer } = require("../NamedPipeServer")
const { spawn } = require("child_process")
const path = require("path")
const { resolve } = require("path")
const jsTestService = require("../jsTestService_grpc_pb");

const TEST_PIPE_MANE = "TEST_PIPE"
const DOTNET_CLIENT_PATH = String.raw`F:\epicMyth-tmp-6-2022\dev\notMyCode\packages src\grpc-dotnet-namedpipes\GrpcDotNetNamedPipes.ConsoleApp\bin\Debug\net6.0\GrpcDotNetNamedPipes.ConsoleApp.exe`


var serviceImpl = {
    sayHello(call, callback) {
        console.log("implementation called")
    }
}

describe("NamedPipeServer", (s) => {


    /**
     * @type {NamedPipeServer}
     */
    var server;
    /**
     * @type {import("child_process").ChildProcessWithoutNullStreams}
     */
    var child_proc;
    it("should create the named pipe server", async function () {
        server = new NamedPipeServer(TEST_PIPE_MANE)

        
    })


    it("should register implementation",  function () {
        
        server.addService(jsTestService.GreeterService, serviceImpl);
    })

    it("should start pipe sertver", async function(){
        return new Promise((resolve,reject)=>{
            server.start((err) => {
                expect(err).to.be.undefined;
                resolve()
            })
        })
        
    })
    it("client able to connect to the pipe server and is sending RequestInit", async function () {
        this.timeout("5000")

        return new Promise((resolve, reject) => {
            const child_proc = spawn(DOTNET_CLIENT_PATH, ["--client-test", "client123"])
            child_proc.on("exit", code => {
                //reject(`client exit code ${code}`)
            })
            child_proc.stdout.on('data', ( /** @type {string} */data) => {
                console.log("client: ",data.toString())
                if (data.includes("Sending <RequestInit> for '/jsTestService.Greeter/SayHello'")) {
                    resolve();
                }
            });
        })


    })
    it("should call implementation method", async function () {
        this.timeout("5000")

        return new Promise((resolve, reject) => {
          

            var serviceImpl = {
                sayHello(call, callback) {
                    console.log("implementation called (test)")
                    resolve();
                }
            }
            server.addService(jsTestService.GreeterService,serviceImpl)
            
            const child_proc = spawn(DOTNET_CLIENT_PATH, ["--client-test", "client123"])
            child_proc.on("exit", code => {
                reject(`client exit code ${code}`)
            })

        })
    })
    it("should sent hello response to client", async function () {
        this.timeout("5000")
        return new Promise((resolve, reject) => {
            const child_proc = spawn(DOTNET_CLIENT_PATH, ["--client-test", "client123"])
            child_proc.on("exit", code => {
                reject(`client exit code ${code}`)
            })
            child_proc.stdout.on('data', ( /** @type {string} */data) => {
                if (data.includes("server response: hello client123")) {
                    resolve();
                }
            });
        })
    })
})








