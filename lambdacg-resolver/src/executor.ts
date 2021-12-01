import { HandlerFactory, HandlerParameters } from 'lambdacg-contract';
import { ExecuteAsyncFunction, Executor } from './executor-contract';


class OptionalExecutor implements Executor {

    execution: string = "optional"

    startExecute(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters) {
        const handlers = handlerFactories.map(f => f.createHandler(requestName));
        return handlers.map(h => h(requestParams));
    }

    executeAsync(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters) {
        return Promise.all(this.startExecute(handlerFactories, requestName, requestParams));
    }
}

class AllExecutor extends OptionalExecutor {

    execution = "all"

    startExecute(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters) {
        if (handlerFactories.length === 0) {
            throw new Error(`Execution is "${this.execution}", but no handlers available ` +
                `for request "${requestName}"`);
        }
        return super.startExecute(handlerFactories, requestName, requestParams);
    }
}


class SingleExecutor extends AllExecutor {

    execution = "single"

    startExecute(handlerFactories: HandlerFactory[], requestName: string, requestParams: HandlerParameters) {
        if (handlerFactories.length > 1) {
            throw new Error(`Execution is "${this.execution}", but multiple handlers available ` +
                `for request "${requestName}": ` +
                handlerFactories.map(f => f.name).join(", "));
        }
        return super.startExecute(handlerFactories, requestName, requestParams);
    }
}

const executorClasses = [OptionalExecutor, AllExecutor, SingleExecutor];

const executorMap = executorClasses.reduce(
    (map: { [key: string]: Executor }, cls: typeof OptionalExecutor): { [key: string]: Executor } => {
        let executor = new cls();
        map[executor.execution] = executor;
        return map;
    }, {});

const executeAsync: ExecuteAsyncFunction = function (execution, handlerFactories, requestName, requestParams) {
    const executor = executorMap[execution];
    if ('object' !== typeof executor) {
        throw new Error(`Unsupported execution: ${execution}. ` +
            `Supported executions: ${Object.getOwnPropertyNames(executorMap).join(", ")}`);
    }

    const selectedFactories = handlerFactories.filter(
        f => 'function' == typeof f?.canHandle && f.canHandle(requestName)
    );

    return executor.executeAsync(selectedFactories, requestName, requestParams);
}

export { executeAsync };
