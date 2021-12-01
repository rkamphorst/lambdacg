import { HandlerResponse, HandlerFactory, HandlerParameters } from 'lambdacg-contract';

type ExecuteAsyncFunction = (execution: string, handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters) => Promise<HandlerResponse[]>;

interface Executor {
    execution: string;
    startExecute(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters): (HandlerResponse | Promise<HandlerResponse>)[]
    executeAsync(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters): Promise<HandlerResponse[]>;
}

export { ExecuteAsyncFunction, Executor };
