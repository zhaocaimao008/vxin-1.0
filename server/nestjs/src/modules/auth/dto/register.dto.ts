import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: '+8613800138000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'alice2025' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username may only contain letters, numbers and underscores' })
  username: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nickname: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
