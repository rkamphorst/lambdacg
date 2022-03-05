import {
    HandlerFactory,
    HandlerFunction,
    HandlerParameters,
    HandlerResponse,
} from "lambdacg-contract";

class Handler2Factory implements HandlerFactory {
    name = "handler2";

    canHandle(requestName: string): boolean {
        return requestName !== "unknown" && requestName !== "notHandler2";
    }

    createHandler(): HandlerFunction {
        return (params: HandlerParameters) => {
            return {
                handler2: "handler2",
                object: {
                    handler2Echo: `handler2 echoes ${params.echo}`,
                    handler2: "handler2",
                    nested: {
                        handler2: "handler2",
                    },
                },
                array: [{ handler2: "handler2" }],
            } as HandlerResponse;
        };
    }
}

export default new Handler2Factory();
