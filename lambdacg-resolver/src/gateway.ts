import { ExecuteAsyncFunction } from "./executor-contract";
import { ComposeFunction } from "./composer-contract";
import { ProviderInterface } from "./provider-contract";
import { HandlerFactory } from "lambdacg-contract";

type GatewayRequest = {
    execution?: string;
    requestName: string;
    requestParams?: { [key: string]: unknown };
    responseTemplate?: { [key: string]: unknown };
};

type GatewaySuccessResponse = {
    success: true;
    response: { [key: string]: unknown };
};

type GatewayErrorResponse = {
    success: false;
    error: string | object;
};

type GatewayResponse = GatewaySuccessResponse | GatewayErrorResponse;

class Gateway {
    #handlerFactoryProvider: ProviderInterface<HandlerFactory>;
    #executeAsync: ExecuteAsyncFunction;
    #compose: ComposeFunction;

    constructor(
        handlerFactoryProvider: ProviderInterface<HandlerFactory>,
        executeAsync: ExecuteAsyncFunction,
        compose: ComposeFunction
    ) {
        this.#handlerFactoryProvider = handlerFactoryProvider;
        this.#executeAsync = executeAsync;
        this.#compose = compose;
    }

    async handleRequestAsync(
        request: GatewayRequest
    ): Promise<GatewayResponse> {
        try {
            const {
                execution: optionalExecution,
                requestName,
                requestParams: optionalRequestParams,
                responseTemplate: optionalResponseTemplate,
            } = request;

            const execution = optionalExecution ?? "all";
            const responseTemplate = optionalResponseTemplate ?? {};
            const requestParams = optionalRequestParams ?? {};

            const handlerFactories =
                await this.#handlerFactoryProvider.provideAsync();

            const responses = await this.#executeAsync(
                execution,
                handlerFactories,
                requestName,
                requestParams
            );

            const response = this.#compose(responseTemplate, responses);

            return {
                success: true,
                response,
            };
        } catch (error) {
            return {
                success: false,
                error,
            };
        }
    }
}

export {
    Gateway,
    GatewayRequest,
    GatewayErrorResponse,
    GatewaySuccessResponse,
    GatewayResponse,
};
