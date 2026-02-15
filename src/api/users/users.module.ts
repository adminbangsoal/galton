import { Global, Module } from '@nestjs/common';
import UsersService from './users.service';
import UsersController from './users.controller';
import { FirebaseModule } from '../../database/firebase/firebase.module';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import { S3Module } from '../../s3/s3.module';

@Global()
@Module({
  controllers: [UsersController],
  providers: [UsersService, ...drizzleProvider],
  imports: [FirebaseModule, S3Module],
  exports: [UsersService],
})
export default class UsersModule {}
