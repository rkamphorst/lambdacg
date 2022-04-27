interface HandlerFactory {
    name: string;

    canHandle(requestName: string): boolean;

    createHandler(requestName: string): HandlerFunction;
}

type HandlerFunction = (
    requestParameters: HandlerParameters
) => HandlerResponse;

interface HandlerResponse {
    [key: string]: unknown;
}

interface HandlerParameters {
    [key: string]: unknown;
}

export { HandlerFactory, HandlerFunction, HandlerParameters, HandlerResponse };
