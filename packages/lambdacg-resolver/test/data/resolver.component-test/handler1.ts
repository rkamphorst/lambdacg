import {
    HandlerFactory,
    HandlerFunction,
    HandlerParameters,
    HandlerResponse,
} from "lambdacg-contract";

class Handler1Factory implements HandlerFactory {
    name = "handler1";

    canHandle(requestName: string): boolean {
        return requestName !== "unknown";
    }

    createHandler(requestName: string): HandlerFunction {
        switch (requestName) {
            case "handler1Throws":
                return () => {
                    throw new Error("handler1");
                };

            default:
                return (params: HandlerParameters) => {
                    return {
                        handler1: "handler1",
                        object: {
                            handler1Echo: `handler1 echoes ${params.echo}`,
                            handler1: "handler1",
                            nested: {
                                handler1: "handler1",
                            },
                        },
                        array: ["handler1"],
                    } as HandlerResponse;
                };
        }
    }
}

export default new Handler1Factory();
