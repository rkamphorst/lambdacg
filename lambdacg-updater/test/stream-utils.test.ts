import { expect } from "chai";
import { Readable, Writable } from "node:stream";

import { streamFinishedAsync, streamToStringAsync } from "../src/stream-utils";
import { expectToThrowAsync } from "./lib/expect-to-throw";
import { describeObject } from "./lib/mocha-utils";

describe("Stream Utils", function () {
    describeObject({ streamFinishedAsync }, async function () {
        it("Should return when a read stream finishes asynchronously", async function () {
            const stream = new Readable({
                read: () => {
                    /*skip */
                },
            });
            const promise = streamFinishedAsync(stream);

            stream.on("data", () => {
                /* skip */
            });
            setTimeout(() => {
                stream.push(null);
            }, 0);

            await promise;
        });

        it("Should return when a read stream is already finished", async function () {
            // Arrange
            const stream = new Readable({
                read: () => {
                    /*skip */
                },
            });
            stream.on("data", () => {
                /* skip */
            });
            stream.push(null);
            await streamFinishedAsync(stream);

            // Act
            await streamFinishedAsync(stream);

            // if/when we arrive here, the second call returned
            // when read stream already finished
        });

        it("Should return when a write stream finishes asynchronously", async function () {
            const stream = new Writable({
                write: (c, e, cb) => {
                    cb();
                },
            });
            const promise = streamFinishedAsync(stream);

            setTimeout(() => {
                stream.write("asdf", "utf-8");
                stream.end();
            }, 0);

            await promise;
        });

        it("Should return when a write stream is already finished", async function () {
            // Arrange
            const stream = new Writable({
                write: (c, e, cb) => {
                    cb();
                },
            });
            stream.end();
            await streamFinishedAsync(stream);

            // Act
            await streamFinishedAsync(stream);

            // if/when we arrive here, the second call returned
            // when read stream already finished
        });

        it("Should throw second time awaited when received an error", async function () {
            const stream = new Readable({
                read: () => {
                    /*skip */
                },
            });
            stream.destroy(new Error());

            await expectToThrowAsync(
                () => streamFinishedAsync(stream)
            );

            await expectToThrowAsync(
                () => streamFinishedAsync(stream)
            );
        });

        it("Should throw when a write receives an error", async function () {
            const stream = new Writable({
                write: () => {
                    /*skip */
                },
            });
            stream.destroy(new Error());

            await expectToThrowAsync(
                () => streamFinishedAsync(stream)
            );

            await expectToThrowAsync(
                () => streamFinishedAsync(stream)
            );
        });
    });

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

            await expectToThrowAsync(
                () => streamToStringAsync(stream),
                (e) => e === expectedError
            );
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
