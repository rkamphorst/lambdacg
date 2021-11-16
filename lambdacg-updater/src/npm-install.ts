import {exec} from "child_process";

const npmInstallAsync = function npmInstallAsync(targetDir: string, packages: string[]) : Promise<void> {
    if(packages.length == 0)
    {
        return Promise.resolve();
    }
    var cmdString = `npm install --save --ignore-scripts --production --prefix "${targetDir}" "${packages.join('" "')}"`;

    return new Promise(function(resolve, reject)
    {
        var cmd = exec(cmdString, {maxBuffer: 200 * 1024},(error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

export {npmInstallAsync}
