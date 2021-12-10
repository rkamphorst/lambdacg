import { HandlerFactory } from "lambdacg-contract";

type ProvideHandlerFactoriesAsyncFunction = () => Promise<HandlerFactory[]>;

export { ProvideHandlerFactoriesAsyncFunction };
