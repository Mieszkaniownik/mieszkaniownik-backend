import { Role, User } from "@prisma/client";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: Role;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  surname?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export function userToMetadata(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    username: user.username,
    name: user.name,
    surname: user.surname,
    phone: user.phone,
    city: user.city,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
