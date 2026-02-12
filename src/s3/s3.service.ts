import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly defaultBucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'S3_SECRET_ACCESS_KEY',
        ),
      },
      region: this.configService.getOrThrow<string>('S3_REGION'),
    });
    this.region = this.configService.getOrThrow<string>('S3_REGION');
    this.defaultBucket = this.configService.getOrThrow<string>('S3_BUCKET');
  }

  async uploadFile(
    file: Express.Multer.File | File | Buffer | ReadableStream,
    key: string,
    bucket: string = this.defaultBucket,
  ) {
    const params = {
      Bucket: bucket,
      Key: key,
      Body:
        file instanceof Buffer || file instanceof ReadableStream
          ? file
          : (file as any).buffer || file,
    };

    const command = new PutObjectCommand(params);

    const response = await this.s3.send(command);

    if (response.$metadata.httpStatusCode == 200) {
      const res = {
        url: `https://${bucket}.s3-${this.region}.amazonaws.com/${key}`,
        key: key,
      };
      return res;
    } else {
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async getPresignedUrl(
    key: string,
    bucket: string = this.defaultBucket,
    expiresIn: number = 3600,
  ) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn,
    });
  }

  getObjectKeyFromUrl(
    url: string = '',
    bucket: string = this.defaultBucket,
  ): string | null {
    if (!url) return null;

    let key = url.split(
      `https://${bucket}.s3-${this.region}.amazonaws.com/`, // is used by new uploaded object to s3 from this.uploadFile method
    )[1];
    if (key) return key;

    key = url.split(
      `https://${bucket}.s3.${this.region}.amazonaws.com/`, // is used by the default value of users.profile_img schema
    )[1];
    if (key) return key;

    console.log(
      `${new Date().toISOString()}: failed to get object key from s3 url '${url}'`,
    );

    return null;
  }
}
