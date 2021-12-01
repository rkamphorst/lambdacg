
interface HandlerFactory {

    name: string;

    canHandle(requestName: string): boolean;

    createHandler(requestName: string): (requestParameters: object) => object;
}


interface HandlerResponse {
    [key: string]: any
}

interface HandlerParameters {
    [key: string]: any
}

export { HandlerFactory, HandlerParameters, HandlerResponse };
