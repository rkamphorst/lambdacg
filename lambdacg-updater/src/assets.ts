import {Readable} from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { promisify  } from "node:util";
import { ConfigurationServicePlaceholders } from "aws-sdk/lib/config_service_placeholders";

const fsStatAsync = promisify(fs.stat);

const fileExistsAsync = async (filePath:string):Promise<boolean> => {
    try {
        return (await fsStatAsync(filePath)).isFile();
    } catch (e) {
        return false;
    }
}

const directoryExistsAsync = async (dirPath:string):Promise<boolean> => {
    try {
        return (await fsStatAsync(dirPath)).isDirectory();
    } catch (e) {
        return false;
    }
}

const findPackageRootAsync = async (startPath:string):Promise<string> => {
    if (!directoryExistsAsync(startPath)) {
        throw new Error(`Path is not a directory: ${startPath}`);
    }

    if (await fileExistsAsync(path.join(startPath, 'package.json'))) {
        return startPath;
    }
    return await findPackageRootAsync(path.dirname(startPath));
}

const getAssetStreamAsync = async (assetName:string):Promise<Readable> => {
    console.log("dirname is " + __dirname);
    const packageRoot = await findPackageRootAsync(__dirname);
    console.log("package root is " + packageRoot);
    const assetPath = path.join(packageRoot, 'assets', assetName);
    console.log("asset path is " + assetPath);

    if (!await fileExistsAsync(assetPath)) {
        throw new Error(`Asset not found: ${assetName}`);
    }

    return fs.createReadStream(assetPath);
}

export {getAssetStreamAsync}