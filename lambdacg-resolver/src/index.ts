import _ from 'lodash';
import { Gateway, GatewayRequest, GatewayResponse } from './gateway';
import { executeAsync } from './executor';
import { compose } from './composer';
import { HandlerFactory } from 'lambdacg-contract';
import { AppSyncResolverEvent } from 'aws-lambda';

const handlerFactories : HandlerFactory[] = require('./handlerFactories.json').map(require);
const gateway = new Gateway(handlerFactories, executeAsync, compose);

function handleEventAsync (event : AppSyncResolverEvent<GatewayRequest,Record<string,any>>) : Promise<GatewayResponse>
{
    return gateway.handleRequestAsync(event.arguments);
}

export { handleEventAsync };
