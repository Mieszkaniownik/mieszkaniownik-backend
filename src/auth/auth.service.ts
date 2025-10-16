import { compare } from 'bcrypt';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { RegisterDto } from '../user/dto/register.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UserService } from '../user/user.service';
import { ResponseDto } from './dto/response.dto';
import { GoogleUser } from './dto/google-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  private async generateToken(email: string): Promise<string> {
    const user = await this.userService.findOne(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const payload = { email, sub: email, role: user.role };
    return this.jwtService.sign(payload);
  }

  async validateToken(payload: {
    email: string;
    sub: string;
  }): Promise<UserResponseDto> {
    try {
      const UserResponseDto = await this.userService.findOneMetadata(
        payload.email,
      );
      return UserResponseDto;
    } catch {
      throw new UnauthorizedException('Invalid token: user not found');
    }
  }

  async signIn(email: string, password: string): Promise<ResponseDto> {
    const user = await this.userService.findOne(email);
    if (user === null) {
      throw new UnauthorizedException();
    }
    if (!user.active) {
      throw new UnauthorizedException();
    }
    let passwordMatches: boolean;
    try {
      if (!user.password) {
        passwordMatches = false;
      } else {
        passwordMatches = await compare(password, user.password);
      }
    } catch {
      passwordMatches = false;
    }
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }
    const token = await this.generateToken(user.email);
    return { token };
  }

  async signUp(
    email: string,
    name: string | undefined,
    surname: string | undefined,
    password: string,
  ): Promise<ResponseDto> {
    try {
      const existingUser = await this.userService.findOne(email);
      if (existingUser) {
        if (!existingUser.active) {
          throw new ConflictException('User with this email is disabled');
        }
        throw new ConflictException('User with this email exists');
      }
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
    }

    const registerDto: RegisterDto = {
      email,
      password,
      name,
      surname,
    };
    const user = await this.userService.create(registerDto);
    const payload = { email: user.email, sub: user.email, role: user.role };
    const token = this.jwtService.sign(payload);
    return { token };
  }

  async googleLogin(googleUser: GoogleUser): Promise<ResponseDto> {
    try {
      const user = await this.userService
        .findOne(googleUser.email)
        .catch(() => null);

      if (user) {
        if (!user.googleId) {
          await this.userService.updateGoogleId(
            user.email,
            googleUser.googleId,
          );
        }

        if (!user.active) {
          throw new UnauthorizedException('User account is disabled');
        }

        const payload = { email: user.email, sub: user.email, role: user.role };
        const token = this.jwtService.sign(payload);
        return { token };
      } else {
        const registerDto: RegisterDto = {
          email: googleUser.email,
          name: googleUser.name,
          surname: googleUser.surname,
          googleId: googleUser.googleId,
          password: '',
        };

        const newUser = await this.userService.createGoogleUser(registerDto);

        const payload = {
          email: newUser.email,
          sub: newUser.email,
          role: newUser.role,
        };
        const token = this.jwtService.sign(payload);
        return { token };
      }
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.error('Google authentication error:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}
