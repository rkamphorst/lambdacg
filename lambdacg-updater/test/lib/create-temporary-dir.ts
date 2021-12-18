import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const prefix = "lambdacg-updater-test-";

function createTemporaryDirAsync() {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export { createTemporaryDirAsync };
