import { getAssetStreamAsync } from "lambdacg-updater/assets";

describe("Assets", () => {
    describe("getAssetStreamAsync", () => {
        it("Should open a stream for existing asset", async () => {
            const readable = await getAssetStreamAsync("lambdacg-resolver.tgz");
            readable.destroy();
        });
    });
});
