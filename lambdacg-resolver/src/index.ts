import { Gateway, GatewayRequest, GatewayResponse } from "./gateway";
import { executeAsync } from "./executor";
import { compose } from "./composer";
import { HandlerFactory } from "lambdacg-contract";
import { AppSyncResolverEvent } from "aws-lambda";

async function getHandlerFactoriesAsync() {
    const moduleNames = (await import("./handlerFactories.json")) as string[];

    return await Promise.all(
        moduleNames.map(async (name) => (await import(name)) as HandlerFactory)
    );
}

const gateway = new Gateway(handlerFactories, executeAsync, compose);

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
