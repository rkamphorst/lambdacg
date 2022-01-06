// import { Updater } from "./updater";
// import { S3TarballRepository } from "./s3-tarball-repository";
// import { ResolverPackage } from "./resolver-package";
// import { S3 } from "aws-sdk";
// import { getAssetStream } from "./assets";
import { npmInstallAsync } from "./npm-utils";
// import { updateLambdaFunctionWithZipStreamAsync } from "./lambda-utils";
// import {Readable} from "node:stream";

// const handlerFactoryS3 = "";
// const lambdaCodeUploadS3 = "";

// const handleAsync = async () => {

//     const s3Client = new S3();

//     const updater = new Updater(
//         () => new S3TarballRepository(s3BucketPrefix, s3Client),
//         () => new ResolverPackage(() => getAssetStream("lambdacg-resolver.tgz"), npmInstallAsync ),
//         (codeZip:Readable) => updateLambdaFunctionWithZipStreamAsync()
//         ))

// }

npmInstallAsync("C:\\dev\\lambdacg\\lambdacg-updater\\banaan", ["lodash"]);
