import { Readable, Writable } from "node:stream";

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

function streamToStringAsync(stream: Readable) {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

export {
    isReadStreamFinishedAsync,
    isWriteStreamFinishedAsync,
    streamToStringAsync,
};
