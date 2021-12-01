import { HandlerResponse } from "lambdacg-contract";
import _ from "lodash";
import { ComposeFunction } from "./composer-contract";

interface DictionaryObject {
    [key: string]: unknown;
}

function mergeItems(item1: unknown, item2: unknown) {
    if (_.isNil(item2)) {
        return item1;
    }

    if (_.isNil(item1)) {
        return item2;
    }

    const type1 = typeof item1;
    const type2 = typeof item2;

    if (type1 !== type2 || type1 !== "object") {
        // (1) items don't have the same type, or
        // (2) the items are not objects, so we cannot merge
        // in these cases we return item1
        return item2;
    }

    const isArray1 = Array.isArray(item1);
    const isArray2 = Array.isArray(item2);

    if (isArray1 !== isArray2) {
        // one of the items is an array and the other isn't.
        // return first item.
        return item2;
    }

    if (isArray1) {
        // both item1 and item2 are an array; merge and remove duplicates
        return _.uniqWith([...item1, ...(item2 as Array<unknown>)], _.isEqual);
    }

    // both items are an object (but not an array); merge the objects
    return mergeObjects(item1 as DictionaryObject, item2 as DictionaryObject);
}

function mergeObjects(
    object1: DictionaryObject,
    object2: DictionaryObject
): DictionaryObject {
    const result: DictionaryObject = {};
    for (const prop2 of Object.keys(object2)) {
        if (Object.prototype.hasOwnProperty.call(object1, prop2)) {
            result[prop2] = mergeItems(object1[prop2], object2[prop2]);
        } else {
            result[prop2] = object2[prop2];
        }
    }
    for (const prop1 of Object.keys(object1)) {
        if (!Object.prototype.hasOwnProperty.call(result, prop1)) {
            result[prop1] = object1[prop1];
        }
    }
    return result;
}

const compose: ComposeFunction = (responseTemplate, responses) => {
    return responses.reduce(mergeItems, responseTemplate) as HandlerResponse;
};

export { compose };
