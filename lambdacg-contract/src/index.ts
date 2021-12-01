interface HandlerFactory {
    name: string;

    canHandle(requestName: string): boolean;

    createHandler(requestName: string): (requestParameters: object) => object;
}

interface HandlerResponse {
    [key: string]: unknown;
}

interface HandlerParameters {
    [key: string]: unknown;
}

export { HandlerFactory, HandlerParameters, HandlerResponse };
