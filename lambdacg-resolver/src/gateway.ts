import { ExecuteAsyncFunction } from "./executor-contract";
import { ComposeFunction } from "./composer-contract";
import { ProvideHandlerFactoriesAsyncFunction } from "./handler-factory-provider-contract";

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
    #handlerFactoryProviderAsync: ProvideHandlerFactoriesAsyncFunction;
    #executeAsync: ExecuteAsyncFunction;
    #compose: ComposeFunction;

    constructor(
        handlerFactoryProviderAsync: ProvideHandlerFactoriesAsyncFunction,
        executeAsync: ExecuteAsyncFunction,
        compose: ComposeFunction
    ) {
        this.#handlerFactoryProviderAsync = handlerFactoryProviderAsync;
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

            const handlerFactories = await this.#handlerFactoryProviderAsync();

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
