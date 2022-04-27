import {
    HandlerFactory,
    HandlerParameters,
    HandlerResponse,
} from "lambdacg-contract";

type ComposeFunction = (
    responseTemplate: HandlerResponse,
    responses: HandlerResponse[]
) => HandlerResponse;

type ExecuteAsyncFunction = (
    execution: string,
    handlerFactories: HandlerFactory[],
    requestName: string,
    requestParams: HandlerParameters
) => Promise<HandlerResponse[]>;

type ProvideHandlerFactoriesAsyncFunction = () => Promise<HandlerFactory[]>;

type GatewayRequest = {
    execution?: string;
    requestName: string;
    requestParams?: { [key: string]: unknown };
    responseTemplate?: { [key: string]: unknown };
};

type GatewaySuccessResponse = {
    success: true;
    response?: { [key: string]: unknown };
};

type GatewayErrorResponse = {
    success: false;
    error: string | object;
};

type GatewayResponse = GatewaySuccessResponse | GatewayErrorResponse;

interface GatewayInterface {
    handleRequestAsync(request: GatewayRequest): Promise<GatewayResponse>;
}

export {
    ComposeFunction,
    ExecuteAsyncFunction,
    GatewayErrorResponse,
    GatewayInterface,
    GatewayRequest,
    GatewayResponse,
    GatewaySuccessResponse,
    ProvideHandlerFactoriesAsyncFunction,
};
