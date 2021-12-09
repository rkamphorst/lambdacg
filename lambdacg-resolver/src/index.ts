import { Gateway, GatewayRequest, GatewayResponse } from "./gateway";
import { executeAsync } from "./executor";
import { compose } from "./composer";
import { AppSyncResolverEvent } from "aws-lambda";
import { ProviderFromImport } from "./provider";
import fs from "node:fs/promises";

const gateway = new Gateway(
    new ProviderFromImport(async () =>
        JSON.parse(
            (await fs.readFile(`${__dirname}/handlerFactories.json`)).toString(
                "utf-8"
            )
        )
    ),
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
