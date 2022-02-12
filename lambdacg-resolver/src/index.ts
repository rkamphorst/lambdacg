import { compose } from "./composer";
import { executeAsync } from "./executor";
import { Gateway } from "./gateway";
import { GatewayRequest, GatewayResponse } from "./gateway-contract";
import {
    getModuleNamesFromEnvironmentVariable,
    provideHandlerFactoriesAsync,
    setHandlerFactoryListSource,
} from "./handler-factory-provider";

setHandlerFactoryListSource(() =>
    Promise.resolve(getModuleNamesFromEnvironmentVariable("HANDLER_FACTORIES"))
);

const gateway = new Gateway(
    provideHandlerFactoriesAsync,
    executeAsync,
    compose
);

function handler(event: GatewayRequest): Promise<GatewayResponse> {
    return gateway.handleRequestAsync(event);
}

export { handler };
