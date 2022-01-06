import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import streamEqualAsync from "stream-equal";

import { getAssetStream } from "../src/assets";
import { describeObject } from "./lib/mocha-utils";

describe("Assets", () => {
    describeObject({ getAssetStream }, () => {
        it("Should open a stream for existing asset", async function () {
            const readable = getAssetStream("lambdacg-resolver.tgz");

            const streamsAreEqual = await streamEqualAsync(
                readable,
                fs.createReadStream(
                    path.resolve(
                        __dirname,
                        "..",
                        "assets",
                        "lambdacg-resolver.tgz"
                    )
                )
            );

            expect(streamsAreEqual, "Streams have equal content").to.be.true;
        });
    });
});
