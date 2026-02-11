import {
  PipeTransform,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

@Injectable()
export class MaxFilesValidationPipe implements PipeTransform {
  transform(value: any) {
    Object.keys(value).forEach((key) => {
      if (value[key]?.[0].size > 10000000) {
        throw new UnprocessableEntityException(
          'File size must be less than 10MB',
        );
      }
    });
    return value;
  }
}
