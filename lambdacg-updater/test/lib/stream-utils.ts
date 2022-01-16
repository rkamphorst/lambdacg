import { Readable, Writable } from "node:stream";

const isStreamFinishedAsync = (stream: Readable | Writable) => {
    return new Promise<void>((resolve, reject) => {
        let isRejectedOrResolved = false;

        const rejectOrResolve = (err: unknown) => {
            if (!isRejectedOrResolved) {
                isRejectedOrResolved = true;
                if (err !== undefined) {
                    reject(err);
                } else {
                    resolve(err);
                }
            }
        };

        stream.on("error", (err: unknown) =>
            rejectOrResolve(err ?? new Error())
        );
        stream.on("close", (err: unknown) => rejectOrResolve(err));
    });
};

const isWriteStreamFinishedAsync = (writeStream: Writable) => {
    if (writeStream.writableFinished) {
        return Promise.resolve(true);
    }
    return isStreamFinishedAsync(writeStream);
};

const isReadStreamFinishedAsync = (readStream: Readable) => {
    if (readStream.readableEnded) {
        return Promise.resolve(true);
    }
    return isStreamFinishedAsync(readStream);
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
