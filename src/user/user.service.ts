import { Role, User } from '@prisma/client';
import { hash } from 'bcrypt';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, userToMetadata } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private database: DatabaseService) {}

  async create(RegisterDto: RegisterDto): Promise<UserResponseDto> {
    const hashedPassword = RegisterDto.password
      ? await hash(RegisterDto.password, 10)
      : undefined;

    const user = await this.database.user.create({
      data: {
        email: RegisterDto.email,
        password: hashedPassword,
        username: RegisterDto.username,
        name: RegisterDto.name,
        surname: RegisterDto.surname,
        phone: RegisterDto.phone,
        city: RegisterDto.city,
        role: Role.USER,
        googleId: RegisterDto.googleId,
      },
    });
    return userToMetadata(user);
  }

  async createGoogleUser(RegisterDto: RegisterDto): Promise<UserResponseDto> {
    return this.create(RegisterDto);
  }

  async updateGoogleId(
    email: string,
    googleId: string,
  ): Promise<UserResponseDto> {
    const user = await this.database.user.update({
      where: { email },
      data: { googleId },
    });
    return userToMetadata(user);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { googleId },
    });
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.database.user.findMany({
      where: { active: true },
    });
    return users.map((user) => userToMetadata(user));
  }

  async findOne(email: string): Promise<User | null> {
    const user = await this.database.user.findUnique({
      where: { email },
    });
    if (user == null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    return user;
  }

  async findOneMetadata(email: string): Promise<UserResponseDto> {
    const user = await this.database.user.findUnique({
      where: { email },
    });
    if (user == null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    return userToMetadata(user);
  }

  async update(
    email: string,
    updateUserDto: UpdateUserDto,
    currentUser: { email: string; role: Role },
  ): Promise<UserResponseDto> {
    const existingUser = await this.database.user.findUnique({
      where: { email },
    });
    if (existingUser == null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    const isAdmin = currentUser.role === Role.ADMIN;
    if (!isAdmin && currentUser.email !== email) {
      throw new ForbiddenException(
        'Admin rights required to update other users.',
      );
    }
    const updateData: Partial<UpdateUserDto & { password?: string }> =
      Object.assign({}, updateUserDto);
    if (updateUserDto.password != null && updateUserDto.password !== '') {
      updateData.password = await hash(updateUserDto.password, 10);
    }
    const user = await this.database.user.update({
      where: { email },
      data: updateData,
    });
    return userToMetadata(user);
  }

  async activate(email: string): Promise<UserResponseDto> {
    const existingUser = await this.database.user.findUnique({
      where: { email },
    });
    if (existingUser === null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    const user = await this.database.user.update({
      where: { email },
      data: { active: true },
    });
    return userToMetadata(user);
  }

  async deactivate(email: string): Promise<UserResponseDto> {
    const existingUser = await this.database.user.findUnique({
      where: { email },
    });
    if (existingUser == null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    const user = await this.database.user.update({
      where: { email },
      data: { active: false },
    });
    return userToMetadata(user);
  }

  async remove(email: string): Promise<void> {
    const existingUser = await this.database.user.findUnique({
      where: { email },
    });
    if (existingUser === null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    await this.database.user.delete({
      where: { email },
    });
  }
}
