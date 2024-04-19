# grpc-js-namedpipes (project in progress)
A Node.js implementation of the protocol used by [GrpcDotNetNamedPipes](https://github.com/cyanfish/grpc-dotnet-namedpipes)

Note: This is not an official [gRPC](https://github.com/grpc/grpc-node/tree/master) implementation. Its mainly designed to 
work with [GrpcDotNetNamedPipes](https://github.com/cyanfish/grpc-dotnet-namedpipes) for scenarios involving
inter-process communication between .NET and Node.js over Named Pipes.

# Features
- [x] NodeJs Server Implementation
  - [x] Unary
  - [x] Server Streaming
  - [ ] Client Streaming
  - [ ] Bidirectional Streaming
- [ ] NodeJs Client Implementation
  - [ ] Unary
  - [ ] Server Streaming
  - [ ] Client Streaming
  - [ ] Bidirectional Streaming

# Usage 
### Node.js Server:
```js
/**
 * service implementation
 */
function sayHello(call, callback) {
    var reply = new greeterMessages.HelloReply();
    reply.setMessage('Hello ' + call.request.getName());
    callback(null, reply);
}

var namedPipeServer = new NamedPipeServer("MY_NAMED_PIPE");
namedPipeServer.addService(greeterServices.GreeterService, { sayHello: sayHello })
namedPipeServer.start((error) => {
    if (error === undefined) {
        console.log("server listening")
    }
})
```

### .NET C# Client:
(see [GrpcDotNetNamedPipes](https://github.com/cyanfish/grpc-dotnet-namedpipes))
```c#
  var channel = new GrpcDotNetNamedPipes.NamedPipeChannel(".", "MY_NAMED_PIPE");
  var client = new Greeter.GreeterClient(channel);

  var response = await client.SayHelloAsync(new HelloRequest { Name = "World" });
  Console.WriteLine(response.Message); //prints "Hello World"
            
```

