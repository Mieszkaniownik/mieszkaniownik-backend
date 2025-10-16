import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from '../user/dto/register.dto';
import { ResponseDto } from './dto/response.dto';
import { AuthGuard as JwtAuthGuard } from './auth.guard';
import { UserResponseDto } from '../user/dto/user-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with an existing account',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged in successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account deactivated',
  })
  async signIn(@Body() loginDto: LoginDto): Promise<ResponseDto> {
    return this.authService.signIn(loginDto.email, loginDto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new account',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Account already exists',
  })
  async signUp(@Body() registerDto: RegisterDto): Promise<ResponseDto> {
    console.log('Register request:', registerDto);
    return this.authService.signUp(
      registerDto.email,
      registerDto.name,
      registerDto.surname,
      registerDto.password,
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user information',
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  async getCurrentUser(
    @Req() req: Request & { user: { email: string } },
  ): Promise<UserResponseDto> {
    return this.authService.validateToken({
      email: req.user.email,
      sub: req.user.email,
    });
  }

  @Get('google/available')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if Google OAuth is available',
  })
  @ApiResponse({
    status: 200,
    description: 'Google OAuth availability status',
  })
  googleAvailable() {
    const isAvailable = !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    );
    return { available: isAvailable };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth login',
  })
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Handle Google OAuth callback',
  })
  async googleAuthRedirect(
    @Req() req: Request & { user: any },
    @Res() res: Response,
  ) {
    try {
      const googleUser = req.user as {
        googleId: string;
        email: string;
        name?: string;
        surname?: string;
        picture?: string;
      };

      const result = await this.authService.googleLogin(googleUser);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch (error) {
      console.error('Google auth error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
}
