"use strict";

import _ from 'lodash';
import { executeAsync } from './executor';
import { compose } from './composer';


const handlerFactories = 
    require('./handlerFactories.json')
    .map(require);



async function handleEvent (event) {

    const { execution, requestName, requestParams, responseTemplate } = event;

    execution = execution ?? "all";

    try {
        const responses = executeAsync(handlerFactories, requestName, execution);
        
        const response = compose(responseTemplate, responses);

        return {
            response
        };
    } catch (error) {
        return {
            error
        };
    }
};


export { handleEvent };
