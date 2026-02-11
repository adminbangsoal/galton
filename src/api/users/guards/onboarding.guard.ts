import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import UsersService from '../users.service';

@Injectable()
export class OnboardingGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the user is onboarded
    const isOnboarded = await this.usersService.isOnboarded(user.userId);
    if (!isOnboarded) {
      throw new UnauthorizedException('User is not onboarded');
    }

    return true;
  }
}
