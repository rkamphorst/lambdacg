import { Lambda, S3 } from "aws-sdk";

import { getAssetStream } from "./assets";
import { LambdaUpdateTarget } from "./lambda-update-target";
import { npmInstallAsync } from "./npm-utils";
import { ResolverPackage } from "./resolver-package";
import { S3TarballRepository } from "./s3-tarball-repository";
import { Updater } from "./updater";

const resolverPackageCodeAsset = "resolver-package.tgz";

const targetLambdaName = process.env.TARGET_LAMBDA;
if (!targetLambdaName) {
    throw new Error("TARGET_LAMBDA not set or empty");
}

const s3HandlerRepositoryUrl = process.env.S3_HANDLER_REPOSITORY;
if (!s3HandlerRepositoryUrl) {
    throw new Error("S3_HANDLER_REPOSITORY not set or empty");
}

const s3CodeFolderUrl = process.env.S3_CODE_FOLDER;
if (!s3CodeFolderUrl) {
    throw new Error("S3_CODE_FOLDER not set or empty");
}

const s3Client = new S3();
const lambdaClient = new Lambda();

const createTarballRepository = () =>
    S3TarballRepository.fromUrl(s3HandlerRepositoryUrl, s3Client);

const createResolverPackage = () =>
    new ResolverPackage(
        () => getAssetStream(resolverPackageCodeAsset),
        npmInstallAsync
    );

const createUpdateTarget = () =>
    new LambdaUpdateTarget(
        {
            lambdaName: targetLambdaName,
            s3FolderUrl: s3CodeFolderUrl,
        },
        s3Client,
        lambdaClient
    );

const updater = new Updater(
    createTarballRepository,
    createResolverPackage,
    createUpdateTarget
);

const handleAsync = async () => {
    await updater.updateToLatestHandlersAsync();
};

export { handleAsync };
