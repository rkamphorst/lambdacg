import {exec} from 'child_process'
import {PassThrough, Readable} from "stream";
import {finished as streamFinishedAsync} from "stream/promises"
import tarStream from "tar-stream";
import gunzip from "gunzip-maybe";
import {tmpName} from 'tmp';
import {createWriteStream, unlink} from 'fs';
import {promisify} from 'util';

type NpmPackageInfo = {
    [key:string]: any
}

type TemporaryNpmTarball = {
    location: string,
    info: NpmPackageInfo
}

function npmInstallAsync(targetDir: string, packages: string[]) : Promise<void> {
    if(packages.length == 0)
    {
        return Promise.resolve();
    }
    var cmdString = `npm install --save --ignore-scripts --production --prefix "${targetDir}" "${packages.join('" "')}"`;

    return new Promise(function(resolve, reject)
    {
        exec(cmdString, {maxBuffer: 200 * 1024},(error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

function readNpmPackageInfoAsync(stream: Readable):Promise<NpmPackageInfo> {
    return new Promise((resolve, reject) => {
        const gunzipTransform = gunzip();
        const extractTransform = tarStream.extract();

        let isResolvedOrRejected = false;
        const resolveOnce = (resolveValue:NpmPackageInfo) => {
            if (!isResolvedOrRejected) {
                isResolvedOrRejected = true;
                resolve(resolveValue);
            }
        }

        const rejectOnce = (error:any) => {
            if (!isResolvedOrRejected) {
                isResolvedOrRejected = true;
                reject(error);
            }
        }

        extractTransform.on('entry', function(header, fileStream, next) {
            // header is the tar header
            // fileStream is the content body (might be an empty stream)            
        
            if (header.type === 'file' && /^(\.\/)?package\/package.json$/.test(header.name)) {
                // read the file and try to parse it as JSON
                const chunks:Buffer[] = [];

                fileStream.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                fileStream.on('end', () => {
                    try 
                    {
                        const pkgSpec = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                        resolveOnce(pkgSpec);
                    } 
                    catch (error) 
                    {
                        rejectOnce(error);
                    } 
                    finally 
                    {
                        isResolvedOrRejected = true;
                        destroyStreams();
                    }
                });

                fileStream.on('error', rejectOnce);
            } 
            else 
            {
                // skkip this file, auto drain the fileStream
                fileStream.on('end', () => next());
                fileStream.resume();
            }
        })
        
        extractTransform.on('finish', 
            () => rejectOnce(Error("Not a valid NPM tarball, no package/package.json found")));

        extractTransform.on('close', 
            () => rejectOnce(Error("Not a valid NPM tarball, no package/package.json found")));

        extractTransform.on('error', rejectOnce);

        stream.pipe(gunzipTransform).pipe(extractTransform);

        function destroyStreams() {
            gunzipTransform.unpipe(extractTransform);
            stream.unpipe(gunzipTransform);

            extractTransform.destroy();
            gunzipTransform.destroy();
        }
    });
}

const unlinkAsync = promisify(unlink);
const tryRemoveFileAsync = (filename:string):Promise<boolean> => {
    return unlinkAsync(filename).then(() => true).catch(e => false);
};
const tmpTgzNameAsync = (dirname?:string):Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        tmpName(
            {
                postfix: "npmpkg.tgz",
                dir: dirname
            },
            (error, name) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(name);
                }
            });
    });
};

async function storeTemporaryNpmTarballAsync(fromStream: Readable, dirname?:string):Promise<TemporaryNpmTarball> {
    const destTgz = await tmpTgzNameAsync(dirname);
    const destStream = createWriteStream(destTgz);
    const readStream = new PassThrough();

    fromStream.pipe(destStream);
    fromStream.pipe(readStream);

    try {
        const info = await readNpmPackageInfoAsync(readStream);
        
        await streamFinishedAsync(destStream);

        return {
            location: destTgz,
            info: info
        };
    } catch (e) {
        destStream.destroy();
        await tryRemoveFileAsync(destTgz);
        throw e;
    }
}


export {
    NpmPackageInfo, 
    TemporaryNpmTarball, 
    npmInstallAsync,
    readNpmPackageInfoAsync,
    storeTemporaryNpmTarballAsync 
};

