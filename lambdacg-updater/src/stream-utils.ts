import { Readable, Writable } from "node:stream";
import { finished as finishedAsync } from "node:stream/promises";

const isStreamFinishedAsync = async (stream: Readable | Writable) => {
    return finishedAsync(stream);
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
