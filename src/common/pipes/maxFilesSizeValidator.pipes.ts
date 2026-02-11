import {
  MaxFileSizeValidator,
  MaxFileSizeValidatorOptions,
} from '@nestjs/common';

export class MaxFileSize extends MaxFileSizeValidator {
  fileSize: number;

  constructor(
    validationOptions: MaxFileSizeValidatorOptions,
    fileSize: number,
  ) {
    super(validationOptions);
    this.fileSize = fileSize;
  }

  buildErrorMessage(): string {
    return `Ukuran file harus kurang dari ${(this.fileSize / 1000000).toFixed(
      0,
    )}MB`;
  }
}
