"use strict";

import _ from 'lodash';
import { executeAsync } from './executor';
import { compose } from './composer';
import { HandlerFactory, HandlerParameters, HandlerResponse } from 'lambdacg-contract';


import { AppSyncResolverEvent } from 'aws-lambda';

const handlerFactories : HandlerFactory[] = require('./handlerFactories.json').map(require);


interface AppSyncEventArguments {
    execution?: string;
    requestName: string;
    requestParams: HandlerParameters;
    responseTemplate: HandlerResponse;
}
    
async function handleEvent (event : AppSyncResolverEvent<AppSyncEventArguments,Record<string,any>>)  {

    const { execution: optionalExecution, requestName, requestParams, responseTemplate } = event.arguments;
    const execution = optionalExecution ?? "all";

    try {
        const responses = await executeAsync(execution, handlerFactories, requestName, requestParams);
        
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
