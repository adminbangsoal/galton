import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TuringGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    if (
      !request.headers['x-turing'] ||
      request.headers['x-turing'] !== process.env.TURING_KEY
    ) {
      return false;
    }

    return request.headers['x-turing'] === process.env.TURING_KEY;
  }
}
