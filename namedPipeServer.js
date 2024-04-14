//@ts-check
class NamedPipeServer{
    /**
     *  
     * @param {string} pipeName 
     */
    constructor (pipeName){
        this.pipeName=pipeName;
    }

}


exports.NamedPipeServer = NamedPipeServer;