
import {S3} from "aws-sdk";
import {URL} from "url";

const s3 = new S3();

const getS3TarballUrlsAsync = (s3UrlString:string) => {
    return new Promise((resolve, reject) => {
      const s3 = new S3();

      const s3Url = new URL(s3UrlString);
      const { hostname: Bucket, pathname } = s3Url;

      const Prefix = pathname.substr(1);

      next(undefined,[]);

      function next(Marker:string, contents:string[]) {
        const params : S3.ListObjectsRequest = {
          Bucket,
          Prefix,
          Delimiter: undefined,
          EncodingType: 'url',
          Marker,
          MaxKeys: 1000,
        };
    
        s3.listObjects(params, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
    
          const { Contents, IsTruncated } = data;
    
          Contents
            .map(({ Key }) => `s3://${Bucket}/${Key}`)
            .filter(url => url.endsWith('.tgz') || url.endsWith(".tar.gz") || url.endsWith(".tar"))
            .forEach(url => contents.push(url));
    
          if (IsTruncated) {
            const last = Contents[Contents.length - 1];
            next(last.Key, contents);
          } else {
            resolve(contents);
            return;
          }
        });
      };
    });
  };

  export {getS3TarballUrlsAsync};