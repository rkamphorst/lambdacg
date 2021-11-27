
import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";

const getS3TarballNamesAsync = async (s3Bucket:string, s3Prefix?:string) => {
      const s3Client = new S3();
      const result:string[] = [];
      let marker : string|undefined = undefined;

      do {
        const listResult:PromiseResult<S3.ListObjectsOutput, AWSError> = await s3Client.listObjects({
            Bucket: s3Bucket,
            Prefix: s3Prefix,
            Delimiter: undefined,
            EncodingType: 'url',
            Marker: marker,
            MaxKeys: 25
        }).promise();

        const listResultContents = listResult.Contents;

        if (listResultContents) {
          listResultContents
            .map(({ Key }) => Key)
            .filter(name => {
              const filename = (s3Prefix ? name?.substr(s3Prefix.length) : name);

              return name && filename && filename.indexOf('/') <= 0 &&
                (name.endsWith('.tgz') || name.endsWith(".tar.gz") || name.endsWith(".tar"))
            })
            .forEach(name => { if (name) { result.push(name) } });

          marker = 
            listResult.IsTruncated ?
            listResultContents[listResultContents.length - 1].Key :
            undefined;
        } else {
          marker = undefined;
        }

      } while (!!marker);

      return result;

  };

  export {getS3TarballNamesAsync};