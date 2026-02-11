import {
  Inject,
  Injectable,
  MethodNotAllowedException,
  NotAcceptableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';
import {
  AuthDto,
  AuthEmailDto,
  PasswordLoginDto,
  SendOtpDto,
  VerifyOtpDto,
} from './authentication.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import { and, eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import SESService from 'src/ses/ses.service';

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private sesService: SESService,
  ) {}

  async login(loginDto: AuthDto) {
    let user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone_number, loginDto.phone_number),
    });

    if (user && user.password) {
      throw new MethodNotAllowedException(
        'Silahkan login menggunakan password anda',
      );
    }

    try {
      await this.verifyOtp(loginDto);
    } catch (e) {
      throw new UnauthorizedException('OTP tidak valid!');
    }
    if (!user) {
      const insertUser = await this.db
        .insert(schema.users)
        .values({
          phone_number: loginDto.phone_number,
        })
        .returning()
        .execute();

      user = insertUser[0];
    }

    const payload = { phone_number: user.phone_number, sub: user.id };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: user.email,
        full_name: user.full_name,
        highschool: user.highschool,
        highschool_year: user.highschool_year,
        choosen_university_one: user.choosen_university_one,
        choosen_major_one: user.choosen_major_one,
        choosen_university_two: user.choosen_university_two,
        choosen_major_two: user.choosen_major_two,
        choosen_major_three: user.choosen_major_three,
        choosen_university_three: user.choosen_university_three,
        phone_number: user.phone_number,
        onboard_date: user.onboard_date,
        profile_picture: user.profile_img,
      },
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user) {
      throw new UnauthorizedException('Kredentials tidak valid!');
    }

    return user;
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phone_number } = sendOtpDto;

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone_number, phone_number),
    });

    if (user && user.password) {
      throw new MethodNotAllowedException(
        'Silahkan login menggunakan password anda',
      );
    }

    const getOtpTries = await this.cacheManager.get<number>(
      `otp-${phone_number}`,
    );

    if (getOtpTries && getOtpTries >= 4) {
      throw new NotAcceptableException(
        'Anda sudah melebihi batas pengiriman OTP silahkan coba lagi dalam waktu 6 jam',
      );
    }
    const twilioAccountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    const client = twilio(twilioAccountSid, twilioAuthToken);

    const verification = await client.verify.v2
      .services('VA39da47dd98e834dc6d5e2af59e4448d2')
      .verifications.create({
        to: phone_number,
        channel: 'whatsapp',
      });

    await this.cacheManager.set(
      `otp-${phone_number}`,
      getOtpTries ? getOtpTries + 1 : 1,
      3600 * 6,
    );

    return verification;
  }

  async sendOTPResetPassword(sendOtpDto: SendOtpDto) {
    const { phone_number } = sendOtpDto;

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone_number, phone_number),
    });
    if (!user) {
      throw new UnauthorizedException('Nomor handphone belum terdaftar!');
    }

    const getOtpTries = await this.cacheManager.get<number>(
      `otp-${phone_number}`,
    );
    if (getOtpTries && getOtpTries >= 4) {
      throw new MethodNotAllowedException(
        'Anda sudah melebihi batas pengiriman OTP silahkan coba lagi dalam waktu 6 jam',
      );
    }
    const twilioAccountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    const client = twilio(twilioAccountSid, twilioAuthToken);

    const verification = await client.verify.v2
      .services('VA39da47dd98e834dc6d5e2af59e4448d2')
      .verifications.create({
        to: phone_number,
        channel: 'whatsapp',
      });

    await this.cacheManager.set(
      `otp-${phone_number}`,
      getOtpTries ? getOtpTries + 1 : 1,
      3600 * 6,
    );

    return verification;
  }

  async passwordLogin({ password, phone_number }: PasswordLoginDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone_number, phone_number),
    });

    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar!');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Email atau password salah!');
    }

    const payload = { phone_number: user.phone_number, sub: user.id };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: user.email,
        full_name: user.full_name,
        highschool: user.highschool,
        highschool_year: user.highschool_year,
        choosen_university_one: user.choosen_university_one,
        choosen_major_one: user.choosen_major_one,
        choosen_university_two: user.choosen_university_two,
        choosen_major_two: user.choosen_major_two,
        choosen_major_three: user.choosen_major_three,
        choosen_university_three: user.choosen_university_three,
        phone_number: user.phone_number,
        onboard_date: user.onboard_date,
        profile_picture: user.profile_img,
      },
    };
  }

  async updatePassword({ password, phone_number }: PasswordLoginDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone_number, phone_number),
    });

    if (!user) {
      throw new UnauthorizedException('Kredentials tidak valid!');
    }

    if (user.password) {
      throw new UnauthorizedException(
        'Anda sudah mengatur password sebelumnya!',
      );
    }

    const salt = await bcrypt.genSalt(10);
    password = await bcrypt.hash(password, salt);

    const update = await this.db
      .update(schema.users)
      .set({
        password: password,
      })
      .where(eq(schema.users.phone_number, phone_number))
      .returning()
      .execute();

    delete update[0].password;

    return update[0];
  }

  async verifyOtp(verif: VerifyOtpDto) {
    const twilioAccountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    const client = twilio(twilioAccountSid, twilioAuthToken);

    const verification = await client.verify.v2
      .services('VA39da47dd98e834dc6d5e2af59e4448d2')
      .verificationChecks.create({
        code: verif.otp,
        to: verif.phone_number,
      });

    if (!verification.valid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    return true;
  }

  async forgotPassword(loginDto: AuthDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone_number, loginDto.phone_number),
    });

    if (!user) {
      throw new UnauthorizedException('Nomor handphone belom terdaftar!');
    }

    try {
      await this.verifyOtp(loginDto);
    } catch (e) {
      throw new UnauthorizedException('OTP tidak valid!');
    }

    // set user password to null
    await this.db
      .update(schema.users)
      .set({
        password: null,
      })
      .where(eq(schema.users.phone_number, loginDto.phone_number))
      .returning()
      .execute();

    const payload = { phone_number: user.phone_number, sub: user.id };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: user.email,
        full_name: user.full_name,
        highschool: user.highschool,
        highschool_year: user.highschool_year,
        choosen_university_one: user.choosen_university_one,
        choosen_major_one: user.choosen_major_one,
        choosen_university_two: user.choosen_university_two,
        choosen_major_two: user.choosen_major_two,
        choosen_major_three: user.choosen_major_three,
        choosen_university_three: user.choosen_university_three,
        phone_number: user.phone_number,
        onboard_date: user.onboard_date,
        profile_picture: user.profile_img,
      },
    };
  }

  async sendEmailVerification({ email }: { email: string }) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(schema.users.email, email)),
    });

    if (user && user.password) {
      throw new NotAcceptableException('Email sudah terdaftar!');
    }

    // generate token with 6 random digit
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    await this.cacheManager.set(`otp-${email}`, token, 3600 * 2);
    await this.sesService.sendMail(
      email,
      'BangSoal Email Verification',
      `Berikut kode OTP BangSoal anda: ${token}`,
    );

    return 'OTP sent!';
  }

  async verifyMailOtp({ otp, email }: { otp: string; email: string }) {
    const otpVerification = await this.cacheManager.get<string>(`otp-${email}`);

    if (!otpVerification || otpVerification !== otp) {
      throw new UnauthorizedException('OTP tidak valid!');
    }

    const user = await this.db.query.users.findFirst({
      where: and(eq(schema.users.email, email)),
    });
    let token = '';

    if (!user) {
      const insertUser = await this.db
        .insert(schema.users)
        .values({
          email: email,
        })
        .returning()
        .execute();

      const user = insertUser[0];

      const payload = { email: user.email, sub: user.id };

      token = this.jwtService.sign(payload);
    } else {
      const payload = { email, sub: user.id };

      token = this.jwtService.sign(payload);
    }

    return {
      token: token,
      user: {
        email: email,
        full_name: user?.full_name,
        highschool: user?.highschool,
        highschool_year: user?.highschool_year,
        choosen_university_one: user?.choosen_university_one,
        choosen_major_one: user?.choosen_major_one,
        choosen_university_two: user?.choosen_university_two,
        choosen_major_two: user?.choosen_major_two,
        choosen_major_three: user?.choosen_major_three,
        choosen_university_three: user?.choosen_university_three,
        phone_number: user?.phone_number,
        onboard_date: user?.onboard_date,
        profile_picture: user?.profile_img,
      },
    };
  }

  async loginEmail(loginDto: AuthEmailDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, loginDto.email),
    });

    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar!');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Email atau password salah!');
    }

    const payload = { email: user.email, sub: user.id };

    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: user.email,
        full_name: user.full_name,
        highschool: user.highschool,
        highschool_year: user.highschool_year,
        choosen_university_one: user.choosen_university_one,
        choosen_major_one: user.choosen_major_one,
        choosen_university_two: user.choosen_university_two,
        choosen_major_two: user.choosen_major_two,
        choosen_major_three: user.choosen_major_three,
        choosen_university_three: user.choosen_university_three,
        phone_number: user.phone_number,
        onboard_date: user.onboard_date,
        profile_picture: user.profile_img,
      },
    };
  }

  async forgotPasswordEmail(email: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar!');
    }

    // generate token with 6 random digit
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    await this.cacheManager.set(`otp-${email}`, token, 3600 * 6);

    await this.sesService.sendMail(
      email,
      'BangSoal Forgot Password',
      `Berikut kode OTP lupa password BangSoal anda: ${token}`,
    );

    return 'OTP sent!';
  }

  async verifyMailOtpForgotPassword({
    otp,
    email,
  }: {
    otp: string;
    email: string;
  }) {
    const verifyEmail = await this.cacheManager.get<string>(`otp-${email}`);

    if (!verifyEmail || verifyEmail !== otp) {
      throw new UnauthorizedException('OTP tidak valid!');
    }

    // set user password to null
    const user = await this.db
      .update(schema.users)
      .set({
        password: null,
      })
      .where(eq(schema.users.email, email))
      .returning()
      .execute();

    const payload = { email: email, sub: user[0].id };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: user[0].email,
        full_name: user[0].full_name,
        highschool: user[0].highschool,
        highschool_year: user[0].highschool_year,
        choosen_university_one: user[0].choosen_university_one,
        choosen_major_one: user[0].choosen_major_one,
        choosen_university_two: user[0].choosen_university_two,
        choosen_major_two: user[0].choosen_major_two,
        choosen_major_three: user[0].choosen_major_three,
        choosen_university_three: user[0].choosen_university_three,
        phone_number: user[0].phone_number,
        onboard_date: user[0].onboard_date,
        profile_picture: user[0].profile_img,
      },
    };
  }
}
