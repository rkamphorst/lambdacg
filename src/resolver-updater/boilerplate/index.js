"use strict";

import _ from 'lodash';

const handlerFactories = 
    require('./handler-factories.json')
    .map(require);



async function handleEvent (event) {

    let { execution, requestName, requestParams, responseTemplate } = event;

    execution = execution ?? "parallel";

    try {
        let selectedFactories = handler_factories.filter(f => f.canHandle(requestName));

        switch (execution) {
            case "single":
                break;
            case "fastest":
                break;
            case "parallel":
                let handlers = selectedFactories.map(f => f.createHandler());
                let responsePromises = handlers.map(h => h(requestParams));
                let responses = await Promise.all(responsePromises);
                return mergeResponses([ responseTemplate, ...responses ]);
            case "parallelOptional":
                break;
            default:
                throw `Unsupported execution: ${execution}. Supported: "single", "first", "parallel"`;
        }
        

        return {
            response
        };
    } catch (error) {
        return {
            error
        };
    }
};

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

export { handleEvent };
