import { Module } from '@nestjs/common';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import PackagesService from './packages.service';
import PackagesController from './packages.controller';

@Module({
  imports: [],
  controllers: [PackagesController],
  providers: [...drizzleProvider, PackagesService],
})
export default class PackagesModule {}
