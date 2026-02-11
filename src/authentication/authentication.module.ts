import { Module } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import SESModule from 'src/ses/ses.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'b4ngsoal',
      signOptions: { expiresIn: '60000s' },
    }),
    SESModule,
  ],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, ...drizzleProvider],
})
export class AuthenticationModule {}
