import { compose } from "./composer";
import { executeAsync } from "./executor";
import { Gateway } from "./gateway";
import { GatewayRequest, GatewayResponse } from "./gateway-contract";
import {
    getModuleNamesFromJsonFileAsync,
    provideHandlerFactoriesAsync,
    setHandlerFactoryListSource,
} from "./handler-factory-provider";

setHandlerFactoryListSource(() =>
    getModuleNamesFromJsonFileAsync("./handlerFactories.json")
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
