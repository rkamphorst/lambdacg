
import {S3} from "aws-sdk";

const getS3TarballNamesAsync = async (s3Bucket:string, s3Prefix?:string) => {
      const s3Client = new S3();
      const result:string[] = [];
      let marker:string = undefined;

      do {
        const listObjectsResult = 
          await s3Client.listObjects({
            Bucket: s3Bucket,
            Prefix: s3Prefix,
            Delimiter: undefined,
            EncodingType: 'url',
            Marker: marker,
            MaxKeys: 25
          }).promise();

        listObjectsResult.Contents
          .map(({ Key }) => Key)
          .filter(name => {
            const filename = (s3Prefix ? name.substr(s3Prefix.length) : name);

            return filename.indexOf('/') <= 0 &&
              (name.endsWith('.tgz') || name.endsWith(".tar.gz") || name.endsWith(".tar"))
          })
          .forEach(name => result.push(name));

        marker = 
          listObjectsResult.IsTruncated ?
            listObjectsResult.Contents[listObjectsResult.Contents.length - 1].Key :
            undefined;

      } while (!!marker);

      return result;

  };

  export {getS3TarballNamesAsync};