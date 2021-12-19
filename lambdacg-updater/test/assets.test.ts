import { getAssetStreamAsync } from "lambdacg-updater/assets";
import { describeObject } from "./lib/mocha-utils";

describe("Assets", () => {
    describeObject({ getAssetStreamAsync }, () => {
        it("Should open a stream for existing asset", async () => {
            const readable = await getAssetStreamAsync("lambdacg-resolver.tgz");
            readable.destroy();
        });
    });
});
