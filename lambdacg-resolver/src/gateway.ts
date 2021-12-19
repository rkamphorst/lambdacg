import {
    ComposeFunction,
    ExecuteAsyncFunction,
    GatewayInterface,
    GatewayRequest,
    GatewayResponse,
    ProvideHandlerFactoriesAsyncFunction,
} from "./gateway-contract";

class Gateway implements GatewayInterface {
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

export { Gateway };
