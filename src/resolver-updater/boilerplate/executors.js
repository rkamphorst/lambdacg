

class OptionalExecutor {
    execution = "optional"

    _startExecute(factories) {
        let handlers = factories.map(f => f.createHandler());
        return handlers.map(h => h(requestParams));
    }

    executeAsync(factories, requestName) {
        return Promise.All(this._startExecute(factories, requestName));
    }
}

class AllExecutor extends OptionalExecutor {

    execution = "all"

    _startExecute(factories, requestName) {
        if (length(factories) == 0) {
            throw new Error(`Execution is "${this.execution}", but no handlers available ` +
                            `for request "${requestName}"`);
        }
        return super._startExecute(factories, requestName);
    }
}


class SingleExecutor extends AllExecutor {
    
    execution = "single"

    _startExecute(factories, requestName) {
        if (length(factories) > 1) {
            throw new Error(`Execution is "${execution}", but multiple handlers available ` +
                            `for request "${requestName}": ` + 
                            factories.map(f => f.name).join(", "));
        }
        return super._startExecute(factories, requestName);
    }
}

class FastestExecutor extends AllExecutor {

    execution = "fastest"

    executeAsync(factories) {
        return Promise.any(this.execute(factories));
    }
    
}

let executorClasses = [ OptionalExecutor, AllExecutor, SingleExecutor, FastestExecutor ];

let executorMap = executorClasses.reduce

