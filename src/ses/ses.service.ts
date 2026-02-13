import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient } from '@aws-sdk/client-ses';
import * as nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';

@Injectable()
export default class SESService {
  private readonly ses: SESClient;
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.ses = new SESClient({
      apiVersion: '2012-10-17',
      region: this.configService.getOrThrow<string>('SES_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('SES_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'SES_SECRET_ACCESS_KEY',
        ),
      },
    });

    this.transporter = nodemailer.createTransport({
      SES: {
        ses: this.ses,
        aws: aws,
      },
    });

    this.fromEmail = this.configService.getOrThrow<string>('SES_FROM_EMAIL');
  }

  async sendMail(email: string, subject: string, message: string) {
    this.transporter.sendMail(
      {
        subject: subject,
        from: this.fromEmail,
        to: email,
        text: message,
      },
      (err, info) => {
        console.log(info.envelope);
        console.log(info.messageId);
      },
    );
    return 'email sent';
  }
}
