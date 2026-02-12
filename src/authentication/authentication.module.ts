import { Module } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import SESModule from 'src/ses/ses.module';
import { FirebaseModule } from 'src/database/firebase/firebase.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'b4ngsoal',
      signOptions: { expiresIn: '60000s' },
    }),
    SESModule,
    FirebaseModule,
  ],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, ...drizzleProvider],
})
export class AuthenticationModule {}
