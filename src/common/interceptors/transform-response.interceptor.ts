import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PageDto } from '../dtos/page.dtos';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, any>
{
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof PageDto) {
          return {
            statusCode: context.switchToHttp().getResponse().statusCode,
            message: 'Success',
            data: data.data,
            meta: {
              page: Number(data.meta.page),
              limit: Number(data.meta.limit),
              itemCount: data.meta.itemCount,
              pageCount: data.meta.pageCount,
              hasPreviousPage: data.meta.hasPreviousPage,
              hasNextPage: data.meta.hasNextPage,
            },
          };
        }

        return {
          statusCode: context.switchToHttp().getResponse().statusCode,
          message: 'Success',
          data,
        };
      }),
    );
  }
}

export default TransformResponseInterceptor;
