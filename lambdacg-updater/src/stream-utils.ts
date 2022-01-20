import { Readable, Writable } from "node:stream";

const isStreamFinishedAsync = (stream: Readable | Writable) => {
    if ("read" in stream && typeof stream.read === "function") {
        // this is a Readable
        const readable = stream as { readableEnded: boolean };
        if (readable.readableEnded) {
            return Promise.resolve(true);
        }
    }

    if ("write" in stream && typeof stream.write === "function") {
        // this is a Writable
        const writable = stream as { writableEnded: boolean };
        if (writable.writableEnded) {
            return Promise.resolve(true);
        }
    }

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

function streamToStringAsync(stream: Readable) {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

export { isStreamFinishedAsync, streamToStringAsync };
