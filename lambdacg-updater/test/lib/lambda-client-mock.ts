import { AWSError, Lambda, Request } from "aws-sdk";
import sinon, { SinonStubbedInstance } from "sinon";

type StringMatch = string | RegExp | ((str: string) => boolean);

const isMatch = (match: StringMatch | undefined, str: string | undefined) => {
    if (match === undefined) {
        return true;
    }
    if (str === undefined) {
        return false;
    }
    if (typeof match === "string") {
        return match === str;
    }
    if (match instanceof RegExp) {
        return match.test(str);
    }
    return match(str);
};

class LambdaClientMock {
    #stub: SinonStubbedInstance<Lambda>;

    constructor() {
        this.#stub = sinon.createStubInstance(Lambda);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        this.#stub.updateFunctionCode = sinon.stub() as any;
        /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    get object(): SinonStubbedInstance<Lambda> {
        return this.#stub;
    }

    setupUpdateFunctionCode(
        lambdaNameMatch: StringMatch | undefined,
        s3BucketMatch: StringMatch | undefined,
        s3KeyMatch: StringMatch | undefined
    ) {
        return this.#stub.updateFunctionCode
            .withArgs(
                sinon.match((arg: Lambda.UpdateFunctionCodeRequest) => {
                    return (
                        isMatch(lambdaNameMatch, arg.FunctionName) &&
                        isMatch(s3BucketMatch, arg.S3Bucket) &&
                        isMatch(s3KeyMatch, arg.S3Key)
                    );
                })
            )
            .returns({
                promise: () => Promise.resolve({}),
            } as Request<Lambda.FunctionConfiguration, AWSError>);
    }
}

export { LambdaClientMock };
