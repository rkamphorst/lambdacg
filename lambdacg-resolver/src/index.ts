import { Gateway, GatewayRequest, GatewayResponse } from "./gateway";
import { executeAsync } from "./executor";
import { compose } from "./composer";
import { provideHandlerFactoriesAsync } from "./handler-factory-provider";
import { AppSyncResolverEvent } from "aws-lambda";

const gateway = new Gateway(
    provideHandlerFactoriesAsync,
    executeAsync,
    compose
);

/**
 * The following is a naïve implementation of a handler for appsync resolver events,
 * only for illustrational purposes.
 * Need som hands-on testing to find out if this will work.
 */

function handleEventAsync(
    event: AppSyncResolverEvent<GatewayRequest, Record<string, unknown>>
): Promise<GatewayResponse> {
    return gateway.handleRequestAsync(event.arguments);
}

export { handleEventAsync };
