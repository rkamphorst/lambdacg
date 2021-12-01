import {unpackNpmPackageContentsInTarball} from "lambdacg-updater/unpack";
import {createReadStream} from "node:fs";
import path from "node:path";
import fs from "node:fs/promises";
import {expect} from "chai";


describe("Unpack", () => {

    describe("unpackNpmPackageContentsInTarball", () => {
        it("Should unpack package to a tmp dir", async () => {
            const readStream = createReadStream("./data/biggerpackage.tgz");
            const unpackDir = await unpackNpmPackageContentsInTarball(readStream);
            console.log(`Unpacked in dir ${unpackDir}`)

            try {
                const isDirectory = (await fs.stat(unpackDir)).isDirectory();
                expect(isDirectory).to.be.true;

                const packagejson = path.join(unpackDir, "package.json");
                const packagejsonExists = (await fs.stat(packagejson)).isFile();
                expect(packagejsonExists).to.be.true;

                const packagejsonContents = await fs.readFile(packagejson, 'utf-8');
                expect(packagejsonContents).to.not.be.null;

                const packagejsonObj = JSON.parse(packagejsonContents);
                expect(packagejsonObj).to.have.property("name");
                expect(packagejsonObj.name).to.be.equal("biggerpackage");

                const indexjs = path.join(unpackDir, "index.js");
                const indexjsExists = (await fs.stat(indexjs)).isFile();
                expect(indexjsExists).to.be.true;

                const libjs = path.join(unpackDir, "lib", "lib.js");
                const libjsExists = (await fs.stat(libjs)).isFile();
                expect(libjsExists).to.be.true;

            } finally {
                await fs.rm(unpackDir, {recursive:true, force:true})
                console.log(`Removed directory with contents: ${unpackDir}`);
            }
        });

    });
});

