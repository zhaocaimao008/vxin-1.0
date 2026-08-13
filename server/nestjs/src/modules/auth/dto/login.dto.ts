import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '+8613800138000', description: 'phone or username' })
  @IsString()
  @IsNotEmpty()
  identity: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
