import { Writable } from "node:stream";

const isWriteStreamFinishedAsync = (writeStream: Writable) => {
    return new Promise<void>((resolve, reject) => {
        if (writeStream.writableFinished) {
            resolve();
        } else {
            writeStream.on("close", (err: unknown) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

export { isWriteStreamFinishedAsync };
