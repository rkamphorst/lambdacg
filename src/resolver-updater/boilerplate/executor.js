"use strict";

class OptionalExecutor {
    
    execution = "optional"

    _startExecute(handlerFactories) {
        const handlers = handlerFactories.map(f => f.createHandler());
        return handlers.map(h => h(requestParams));
    }

    executeAsync(handlerFactories, requestName) {
        return Promise.All(this._startExecute(handlerFactories, requestName));
    }
}

class AllExecutor extends OptionalExecutor {

    execution = "all"

    _startExecute(handlerFactories, requestName) {
        if (length(handlerFactories) == 0) {
            throw new Error(`Execution is "${this.execution}", but no handlers available ` +
                            `for request "${requestName}"`);
        }
        return super._startExecute(handlerFactories, requestName);
    }
}


class SingleExecutor extends AllExecutor {
    
    execution = "single"

    _startExecute(handlerFactories, requestName) {
        if (length(handlerFactories) > 1) {
            throw new Error(`Execution is "${execution}", but multiple handlers available ` +
                            `for request "${requestName}": ` + 
                            handlerFactories.map(f => f.name).join(", "));
        }
        return super._startExecute(handlerFactories, requestName);
    }
}

class FastestExecutor extends AllExecutor {

    execution = "fastest"

    executeAsync(handlerFactories) {
        return Promise.any(this.execute(handlerFactories));
    }
    
}

const executorClasses = [ OptionalExecutor, AllExecutor, SingleExecutor, FastestExecutor ];

const executorMap = executorClasses.reduce(
    (map, cls) => {
        executor = new cls();
        map[executor[execution]] = executor;
    }, {});

const executeAsync = function(handlerFactories, requestName, execution) {
    const executor = executorMap[execution];
    if ('object' !== typeof executor) {
        throw new Error(`Unsupported execution: ${execution}. `+
                        `Supported executions: ${Object.getOwnPropertyNames(executorMap).join(", ")}`);
    }
    
    const selectedFactories = handlerFactories.filter(
        f => 'function'==typeof f?.canHandle(requestName) && f.canHandle(requestName)
        );

    return executor.executeAsync(selectedFactories, requestName);
}

export { executeAsync };
