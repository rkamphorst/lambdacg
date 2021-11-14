import { ExecuteAsyncFunction } from './executor-contract';
import { ComposeFunction } from './composer-contract';
import { HandlerFactory } from 'lambdacg-contract';

type GatewayRequest = {
    execution?: string;
    requestName: string;
    requestParams?: any;
    responseTemplate?: any;
}

type GatewaySuccessResponse = {
    success: true;
    response: any;
}

type GatewayErrorResponse = {
    success: false;
    error: any;
}

type GatewayResponse = GatewaySuccessResponse | GatewayErrorResponse;

class Gateway {

    #handlerFactories: HandlerFactory[]
    #executeAsync: ExecuteAsyncFunction
    #compose: ComposeFunction
    
    constructor(handlerFactories: HandlerFactory[], executeAsync: ExecuteAsyncFunction, compose: ComposeFunction) {
        this.#handlerFactories = handlerFactories;
        this.#executeAsync = executeAsync;
        this.#compose = compose;
    }

    async handleRequestAsync(request: GatewayRequest):Promise<GatewayResponse> {
        try {
            const { 
                execution: optionalExecution, 
                requestName, 
                requestParams: optionalRequestParams, 
                responseTemplate: optionalResponseTemplate  
            } = request;

            const execution = optionalExecution ?? "all";
            const responseTemplate = optionalResponseTemplate ?? {};
            const requestParams = optionalRequestParams ?? {};

            const responses = await this.#executeAsync(execution, this.#handlerFactories, requestName, requestParams);
            
            const response = this.#compose(responseTemplate, responses);
    
            return {
                success: true,
                response
            };
        } catch (error) {
            return {
                success: false,
                error
            };
        }
    }

}

export { Gateway, GatewayRequest, GatewayErrorResponse, GatewaySuccessResponse, GatewayResponse };
