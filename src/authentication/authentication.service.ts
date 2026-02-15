import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import {
  RegisterDto,
  LoginDto,
  GoogleSignInDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './authentication.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import SESService from '../../ses/ses.service';
import { FirebaseService } from '../../database/firebase/firebase.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private sesService: SESService,
    private firebaseService: FirebaseService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar!');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        email: email,
        password: hashedPassword,
        is_email_verified: true,
      })
      .returning()
      .execute();

    // Generate JWT token
    const payload = { email: newUser.email, sub: newUser.id };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        email: newUser.email,
        full_name: newUser.full_name,
        highschool: newUser.highschool,
        highschool_year: newUser.highschool_year,
        choosen_university_one: newUser.choosen_university_one,
        choosen_major_one: newUser.choosen_major_one,
        choosen_university_two: newUser.choosen_university_two,
        choosen_major_two: newUser.choosen_major_two,
        choosen_major_three: newUser.choosen_major_three,
        choosen_university_three: newUser.choosen_university_three,
        phone_number: newUser.phone_number,
        onboard_date: newUser.onboard_date,
        profile_picture: newUser.profile_img,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar!');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Akun ini belum memiliki password. Silakan gunakan Google Sign In atau reset password.',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

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

  async googleSignIn(googleSignInDto: GoogleSignInDto) {
    const { idToken } = googleSignInDto;

    try {
      // Verify Firebase ID token
      const decodedToken = await this.firebaseService.verifyIdToken(idToken);
      const { email, name, picture } = decodedToken;

      if (!email) {
        throw new BadRequestException('Email tidak ditemukan di token Google');
      }

      // Check if user exists
      let user = await this.db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });

      if (!user) {
        // Create new user
        const [newUser] = await this.db
          .insert(schema.users)
          .values({
            email: email,
            full_name: name || null,
            profile_img: picture || null,
            is_email_verified: true,
          })
          .returning()
          .execute();
        user = newUser;
      } else {
        // Update user info if needed
        if (!user.full_name && name) {
          await this.db
            .update(schema.users)
            .set({ full_name: name })
            .where(eq(schema.users.id, user.id))
            .execute();
        }
        if (!user.profile_img && picture) {
          await this.db
            .update(schema.users)
            .set({ profile_img: picture })
            .where(eq(schema.users.id, user.id))
            .execute();
        }
      }

      // Generate JWT token
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
    } catch (error) {
      throw new UnauthorizedException(`Google Sign In gagal: ${error.message}`);
    }
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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        message: 'Jika email terdaftar, link reset password telah dikirim',
      };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');

    // Store reset token in cache
    await this.cacheManager.set(
      `reset-token-${resetToken}`,
      email,
      3600, // 1 hour
    );

    // Send reset email
    const resetUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    )}/reset-password?token=${resetToken}`;

    await this.sesService.sendMail(
      email,
      'BangSoal Reset Password',
      `Klik link berikut untuk reset password Anda: ${resetUrl}\n\nLink ini berlaku selama 1 jam.`,
    );

    return {
      message: 'Jika email terdaftar, link reset password telah dikirim',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    // Verify reset token
    const email = await this.cacheManager.get<string>(`reset-token-${token}`);

    if (!email) {
      throw new UnauthorizedException(
        'Token reset password tidak valid atau sudah kadaluarsa',
      );
    }

    // Find user
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    await this.db
      .update(schema.users)
      .set({
        password: hashedPassword,
      })
      .where(eq(schema.users.email, email))
      .execute();

    // Delete reset token
    await this.cacheManager.del(`reset-token-${token}`);

    return {
      message: 'Password berhasil direset',
    };
  }

  // Legacy method for backward compatibility - redirects to login
  async loginEmail(loginDto: LoginDto) {
    return this.login(loginDto);
  }
}
