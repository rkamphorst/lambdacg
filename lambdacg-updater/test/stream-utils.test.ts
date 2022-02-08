import { expect } from "chai";
import { Readable, Writable } from "node:stream";

import {
    streamFinishedAsync,
    streamToStringAsync,
} from "../src/stream-utils";
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

        it("Should throw when a read receives an error", async function () {
            const expectedError = new Error();
            const stream = new Readable({
                read: () => {
                    throw expectedError;
                },
            });
            const promise = streamFinishedAsync(stream);
            let emittedError: undefined | Error = undefined;

            stream.on("data", () => {
                /* skip */
            });
            stream.on("error", (e) => (emittedError = e));
            setTimeout(() => {
                stream.push(null);
            }, 0);

            await expectToThrowAsync(
                () => promise,
                (e) => e === expectedError
            );
            expect(emittedError).to.be.equal(expectedError);
        });

        it("Should not throw second time awaited when received an error", async function () {
            const expectedError = new Error();
            const stream = new Readable({
                read: () => {
                    /*skip */
                },
            });
            stream.destroy(expectedError);

            await expectToThrowAsync(
                () => streamFinishedAsync(stream),
                (e) => e === expectedError
            );

            await expectToThrowAsync(
                () => streamFinishedAsync(stream),
                (e) => e === expectedError
            );
        });

        it("Should throw when a write receives an error", async function () {
            this.skip();
        });
    });

    describeObject({ streamToStringAsync }, function () {
        it("Should read the entire stream to a string", async function () {
            this.skip();
        });

        it("Should throw when the stream receives an error", async function () {
            this.skip();
        });

        it("Should throw when the stream has received an error", async function () {
            this.skip();
        });
    });
});
