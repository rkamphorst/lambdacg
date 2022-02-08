import { expect } from "chai";
import { Readable } from "node:stream";

import { streamToStringAsync } from "../src/stream-utils";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

describe("Stream Utils", function () {
    describeObject({ streamToStringAsync }, function () {
        it("Should read the entire stream to a string", async function () {
            const stream = new Readable({
                read: () => {
                    setTimeout(() => {
                        stream.push("a");
                        stream.push("b");
                        stream.push("c");
                        stream.push(null);
                    }, 0);
                },
            });

            const str = await streamToStringAsync(stream);

            expect(str).to.be.equal("abc");
        });

        it("Should throw when the stream receives an error", async function () {
            const expectedError = new Error();
            const stream = new Readable({
                read: () => {
                    throw expectedError;
                },
            });
        });

        it("Should throw when the stream has received an error", async function () {
            const expectedError = new Error();
            const stream = new Readable({
                read: () => {
                    /*skip */
                },
            });
            stream.destroy(expectedError);

            await expectToThrowAsync(
                () => streamToStringAsync(stream),
                (e) => e === expectedError
            );
        });
    });
});
