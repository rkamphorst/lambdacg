import { finished, Readable, Writable } from "node:stream";

function streamFinishedAsync(stream: Readable | Writable) {
    return new Promise<void>((resolve, reject) => {
        finished(stream, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function streamToStringAsync(stream: Readable) {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

export { streamFinishedAsync, streamToStringAsync };
