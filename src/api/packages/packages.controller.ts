import { Controller, Get } from '@nestjs/common';
import PackagesService from './packages.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Packages')
@Controller('packages')
export default class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('')
  async getAllPackages() {
    return this.packagesService.getAllPackages();
  }
}
