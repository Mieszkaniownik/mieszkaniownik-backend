import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { DatabaseService } from "../database/database.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserMetadata } from "./dto/user-metadata.dto";


@Injectable()
export class UserService {
  constructor(private database: DatabaseService) {}

  async findOneOrFail(email: string): Promise<User> {
    const found = await this.database.user.findUnique({
      where: { email },
    });
    if (found === null) {
      throw new NotFoundException("User not found");
    }
    return found;
  }

  async userAlreadyExist(email: string, login: string, age: number) {
    const found = await this.database.user.findUnique({
      where: { email },
    });
    if (found != null) {
      throw new ConflictException("User with that data allready exist");
    }
  }

  async registerUser(registerUser: RegisterUserDto) {
    await this.userAlreadyExist(
      registerUser.email,
      registerUser.name || "",
      0,
    );
    return this.database.user.create({
      data: {
        email: registerUser.email,
        name: registerUser.name,
        surname: registerUser.surname,
        password: registerUser.password,
        isEnabled: true,
      },
    });
  }

  async disableAccount(email: string) {
    const user = await this.findOneOrFail(email);
    user.isEnabled = false;
    return await this.database.user.update({
      where: { email },
      data: {
        ...user,
      },
    });
  }

  async enableAccount(email: string) {
    const user = await this.findOneOrFail(email);
    user.isEnabled = true;
    return await this.database.user.update({
      where: { email },
      data: {
        ...user,
      },
    });
  }

  async findOne(email: string): Promise<User | null> {
    return this.database.user.findUnique({ where: { email } });
  }
  async findAll(): Promise<User[]> {
    return this.database.user.findMany();
  }

  async updateUserData(
    email: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const cleanData: Partial<UpdateUserDto> = {};

    for (const key of Object.keys(updateUserDto) as (keyof UpdateUserDto)[]) {
      const value = updateUserDto[key];
      if (value !== undefined) {
        (cleanData as Record<keyof UpdateUserDto, unknown>)[key] = value;
      }
    }

    return this.database.user.update({
      where: { email },
      data: cleanData,
    });
  }
  async remove(email: string) {
    await this.findOneOrFail(email);
    return this.database.user.delete({ where: { email } });
  }

  async findOneMetadata(email: string): Promise<UserMetadata> {
    const user = await this.database.user.findUnique({
      where: { email },
    });
    if (user == null) {
      throw new NotFoundException(`User ${email} not found`);
    }
    return this.userToMetadata(user);
  }

  async create(createUserDto: CreateUserDto){
    const existingUser = await this.findOne(createUserDto.email);
    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return this.database.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        surname: createUserDto.surname,
        password: hashedPassword,
        role: Role.USER,
        isEnabled: true,
      },
    });
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private userToMetadata(user: User): UserMetadata {
    return {
      email: user.email,
      name: user.name,
      surname: user.surname,
      role: user.role,
      isEnabled: user.isEnabled,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

}