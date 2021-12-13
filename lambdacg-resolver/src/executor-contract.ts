import {
    HandlerResponse,
    HandlerFactory,
    HandlerParameters,
} from "lambdacg-contract";

interface Executor {
    execution: string;
    startExecute(
        handlerFactories: HandlerFactory[],
        requestName: string,
        requestParams: HandlerParameters
    ): (HandlerResponse | Promise<HandlerResponse>)[];
    executeAsync(
        handlerFactories: HandlerFactory[],
        requestName: string,
        requestParams: HandlerParameters
    ): Promise<HandlerResponse[]>;
}

export { Executor };
