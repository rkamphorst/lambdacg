import { Lambda, S3 } from "aws-sdk";

import { getAssetStream } from "./assets";
import { LambdaUpdateTarget } from "./lambda-update-target";
import { npmInstallAsync } from "./npm-utils";
import { ResolverPackage } from "./resolver-package";
import { S3TarballRepository } from "./s3-tarball-repository";
import { Updater } from "./updater";

const resolverPackageCodeAsset = "lambdacg-resolver.tgz";
const targetLambdaName = "lambdacg-resolver";

const handlerFactoryS3Folder = "";
const targetLambdaCodeUploadS3Folder = "";

const s3Client = new S3();
const lambdaClient = new Lambda();

const createTarballRepository = () =>
    S3TarballRepository.fromUrl(handlerFactoryS3Folder, s3Client);

const createResolverPackage = () =>
    new ResolverPackage(
        () => getAssetStream(resolverPackageCodeAsset),
        npmInstallAsync
    );

const createUpdateTarget = () =>
    new LambdaUpdateTarget(
        {
            lambdaName: targetLambdaName,
            s3FolderUrl: targetLambdaCodeUploadS3Folder,
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
