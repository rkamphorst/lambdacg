import { Writable, Readable } from "node:stream";

const isWriteStreamFinishedAsync = (writeStream: Writable) => {
    return new Promise<void>((resolve, reject) => {
        if (writeStream.writableFinished) {
            resolve();
            return;
        }
        writeStream.on("close", (err: unknown) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const isReadStreamFinishedAsync = (readStream: Readable) => {
    return new Promise<void>((resolve, reject) => {
        if (readStream.readableEnded) {
            resolve();
            return;
        }
        readStream.on("close", (err: unknown) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

export { isWriteStreamFinishedAsync, isReadStreamFinishedAsync };
