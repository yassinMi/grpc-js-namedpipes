const {NamedPipeServer} = require("../namedPipeServer")
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

exports.startServer = startServer;