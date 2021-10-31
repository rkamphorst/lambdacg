const npm = require('global-npm');
const util = require('util');
const npmLoad = util.promisify(npm.load.bind(npm));
const path = require('path');
const {tmpdir} = require('os');

const installAsync = async (packages, install_location) => {
    await npmLoad();
    let npmInstall = util.promisify(npm.commands.install);

    npm.prefix = install_location;
    npm.config.set('progress', false);
    npm.config.set('loglevel', 'silent');
    npm.config.set('save', false);


    
    await npmInstall(packages);
}

const installAndImportAsync = async(packages, root_location) => {

    // install the requested packages to a temporary location
    let tmp_package_dir = path.join(tmpdir()}, "lambda-resolver-packages");
    await installAsync(packages, tmp_package_dir);

    console.log(`Installed packages to ${tmp_package_dir}`);

    /**
     * The following sets the NODE_PATH environment variable and does the re-initializations
     * for this change to take effect in the current process. 
     * Needed to be able to (a) be able to require the installed modules, and (b) to have the
     * required modules to be able to consume dependencies that are installed on the running
     * host. 
     */
    
    process.env.NODE_PATH = 
        ([ 
            ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []), 
            root_location, 
            tmp_package_dir 
        ]).join(path.delimiter);

    // this bit is tricky, as it is not a public api.
    require("module").Module._initPaths();

    console.log(`NODE_PATH is now ${process.env.NODE_PATH}`);


    // now, attempt to load the installed packages
    let result = packages.map(p => require(p));
    return result;
}

installAndImportAsync(['lodash'], __dirname).then((ms) => console.log(ms));