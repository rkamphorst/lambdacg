"use strict";

import _ from 'lodash';


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
    executeAsync(factories) {
        return Promise.any(this.execute(factories));
    }
}





async function executeAsync(handlerFactories, execution) {
    let selectedFactories = handlerFactories.filter(f => {
        'function' === typeof f?.canHandle && true === f.canHandle(requestName);
    });

    if (execution !== "optional") {
        if (length(selectedFactories) == 0) {
            throw new Error(`Execution is "${execution}", but no handlers available ` +
                            `for request "${requestName}"`);
        }
    }

    if (execution === "single") {
        if (length(selectedFactories) > 1) {
            throw new Error('Execution is "single", but multiple handlers available ' +
                            `for request "${requestName}": ` + 
                            selectedFactories.map(f => f.name).join(", "));
        }
    }

    let handlers = selectedFactories.map(f => f.createHandler());
    let responsePromises = handlers.map(h => h(requestParams));
    let responses = await Promise.all(responsePromises);

    switch (execution) {
        case "single":
        case "fastest":
        case "all":
        case "optional":
            break;
        default:
            throw new Error(`Unsupported execution: ${execution}. Supported: "single", "first", "parallel"`);
    }
}

function combineResponses(responseTemplate, responses) 
{
    return mergeItems(responses)
}

function mergeItems (item1, item2) {

    if (_.isNil(item2)) {
        return item1;
    }

    if (_.isNil(item1)) {
        return item2;
    }

    let type1 = typeof item1;
    let type2 = typeof item2;

    if (type1 !== type2 || type1 !== 'object') {
        // (1) items don't have the same type, or
        // (2) the items are not objects, so we cannot merge
        // in these cases we return item1
        return item1;
    }


    let isArray1 = Array.isArray(item1);
    let isArray2 = Array.isArray(item2);

    if (isArray1 !== isArray2) {
        // one of the items is an array and the other isn't. 
        // return first item.
        return item1;
    }

    if (isArray1) {
        // both item1 and item2 are an array; merge and remove duplicates
        return _.uniqWith(item1+item2, _.isEqual);
    }

    // both items are an object (but not an array); merge the objects
    return mergeObjects(item1, item2);
}

function mergeObjects (object1, object2) {
    const result = {};
    for (const prop1 in Object.getOwnPropertyNames(object1)) {
        if (object2.hasOwnProperty(prop1)) {
            result[prop1] = mergeItems(object1[prop1], object2[prop1])
        } else {
            result[prop1] = object1[prop1];
        }
    }
    for (const prop2 in Object.getOwnPropertyNames(object2)) {
        if (!result.hasOwnProperty(prop2)) {
            result[prop2] = object2[prop2];
        }
    }
    return result;
}

export { executeAsync, combineResponses };
