import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class AcademicStatisticDTO {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsNumber()
  year: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  ptn: string;
}