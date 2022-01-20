import { ReadStream } from "node:fs";
import {Readable,ReadableOptions,Writable, WritableOptions} from "node:stream";
import {
    isStreamFinishedAsync,
    streamToStringAsync,
} from "../src/stream-utils";
import { describeObject } from "./lib/mocha-utils";

class MockReadStream extends Readable {

    constructor(options:ReadableOptions) {
        super(options);
    }

    override _read(): void {
        
    }

    override _destroy(error: Error, callback: (error?: Error) => void): void {
        
    }

}

class MockWriteStream extends Writable {
    constructor(options:WritableOptions) {
        super(options);
    }

    override _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): void {
        
    }

    override _destroy(error: Error, callback: (error?: Error) => void): void {
        
    }
}


describe("Stream Utils", function () {
    describeObject({ isStreamFinishedAsync }, function () {
        it("Should return when a read stream finishes asynchronously", async function () {
            this.skip();
        });

        it("Should return when a read stream is already finished", async function () {
            this.skip();
        });

        it("Should return when a write stream finishes asynchronously", async function () {
            this.skip();
        });

        it("Should return when a write stream is already finished", async function () {
            this.skip();
        });

        it("Should throw when a read receives an error", async function () {
            this.skip();
        });

        it("Should throw when a read has received an error", async function () {
            this.skip();
        });

        it("Should throw when a write receives an error", async function () {
            this.skip();
        });

        it("Should throw when a write has received an error", async function () {
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
