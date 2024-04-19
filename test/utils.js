const {NamedPipeServer} = require("../namedPipeServer")
const { spawn } = require("child_process")
const TEST_PIPE_MANE = "TEST_PIPE"
const DOTNET_CLIENT_PATH = process.env.DOTNET_CLIENT_PATH;


/**
 * 
 * @param {NamedPipeServer} server 
 * @returns {Promise<void>}
 */
function startServer(server) {
    return new Promise((resolve, reject) => {
        server.start((err) => {
            if(err===undefined) resolve();
            reject(err);
        })
    })
}

/**
 * invokes the dotnet client app which runs the test by test name
 * @param {string} testName 
 * @returns {Promise<void>}
 */
 async function runClientTestWithTestName(testName,service, serviceImpl) {
    let server = new NamedPipeServer(TEST_PIPE_MANE)
    try {
        // @ts-ignore
        server.addService(service, serviceImpl);
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
        if (server && server.pipeServer && server.pipeServer.listening){
            await new Promise(res=> server.pipeServer.close(cb=>{res()}));
            //await new Promise (res => setTimeout(res,500))
        }
           
    }
}

exports.startServer = startServer;
exports.runClientTestWithTestName = runClientTestWithTestName