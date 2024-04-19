//@ts-check
const ReaderState = {
    ZERO: 0,
    READING_SIZE: 1,
    READING_MESSAGE: 2
}

class StreamPacketsReader {


    constructor() {

        this.SizeBytes = Buffer.alloc(4);
        this.MessageBytes = Buffer.alloc(0);
        this.PayloadBytes = Buffer.alloc(0);
        this.ReadSizeSize = 0;
        this.ReadMessageSize = 0;
        this.ExpectedMessageSize = 0;
        this.readerState = ReaderState.ZERO;
        this.handleMessage = async (buffer) => { };
        this.handlePayload = async (buffer) => { };
        this.expectPayload = -1;//-1: not expecting payload, otherwise expecting a payload of the specified size

        //this.ExpectedSizeSize=4;//hardcoded, always 4
    }


    /**
     * incrementally wtire partial data, returns any finished messages packets
     * @param {Buffer} bytes 
     */
    async write(bytes) {
        //console.log(`entered write, state is ${this.readerState}, expected payload bytes=${this.expectPayload}, expected packet bytes=${this.ExpectedMessageSize - this.ReadMessageSize}`, this.readerState)
        var messages = []
        let pos = 0;
        while (bytes.length > pos) {
            if (this.readerState == ReaderState.ZERO) {
                this.readerState = ReaderState.READING_SIZE;
                this.MessageBytes = Buffer.alloc(0);
                this.SizeBytes.fill(0);
                this.ReadSizeSize = 0;
            }
            else if (this.readerState == ReaderState.READING_SIZE) {
                var sizeBytesToBeRead = Math.min(bytes.length - pos, 4 - this.ReadSizeSize);
                bytes.copy(this.SizeBytes, this.ReadSizeSize, pos, pos + sizeBytesToBeRead);
                this.ReadSizeSize += sizeBytesToBeRead;
                pos += sizeBytesToBeRead;
                if (this.ReadSizeSize === 4) {
                    this.ExpectedMessageSize = this.SizeBytes.readUint32LE(0);
                    this.ReadMessageSize = 0;
                    console.log("parsed packet size: ", this.ExpectedMessageSize);
                    this.readerState = ReaderState.READING_MESSAGE;
                }
            }
            else if (this.readerState == ReaderState.READING_MESSAGE) {
                var sizeBytesToBeRead = Math.min(bytes.length - pos, this.ExpectedMessageSize - this.ReadMessageSize);
                let newChunck = bytes.subarray(pos, pos + sizeBytesToBeRead);
                this.MessageBytes = Buffer.concat([this.MessageBytes, newChunck])
                this.ReadMessageSize += sizeBytesToBeRead;
                pos += sizeBytesToBeRead;
                if (this.ReadMessageSize == this.ExpectedMessageSize) {
                    //end of a message Packet
                    console.log(`reached packet end, pushing ${this.MessageBytes.length} bytes packet`)
                    messages.push(this.MessageBytes);
                    await this.handleMessage(this.MessageBytes);
                    if (this.expectPayload !== -1) {
                        this.readerState = ReaderState.READING_PAYLOAD
                    }
                    else {
                        this.readerState = ReaderState.ZERO;
                    }
                }
            }
            else if (this.readerState == ReaderState.READING_PAYLOAD) {
                //console.log(`in reading payload state, pos=${pos}, remaining bytes=${this.expectPayload}, written bytes=${this.PayloadBytes.length}`)
                var sizeToBeRead = Math.min(bytes.length - pos, this.expectPayload);
                let plChunk = bytes.subarray(pos, pos + sizeToBeRead);
                this.PayloadBytes = Buffer.concat([this.PayloadBytes, plChunk])
                this.expectPayload -= sizeToBeRead;
                pos += sizeToBeRead;
                if (this.expectPayload == 0) {
                    //we finished reading payload, fire event
                    console.log("reached payload end, calling handle payload")
                    await this.handlePayload(this.PayloadBytes)
                    this.readerState = ReaderState.ZERO;
                    this.expectPayload = -1;
                }
                else if (this.expectPayload < 0) {
                    console.log("unexpected negative count")
                }
            }
        }
        return messages;

    }


}

exports.StreamPacketsReader = StreamPacketsReader;