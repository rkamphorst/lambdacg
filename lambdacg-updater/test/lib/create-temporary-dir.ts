import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const prefix = "lambdacg-updater-test-";

function createTemporaryDirAsync() {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export { createTemporaryDirAsync };
