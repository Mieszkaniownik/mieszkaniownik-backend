import type { Request, Response } from "express";

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
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { RegisterDto } from "../user/dto/register.dto";
import { UserResponseDto } from "../user/dto/user-response.dto";
import { AuthGuard as JwtAuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ResponseDto } from "./dto/response.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Log in with an existing account",
  })
  @ApiResponse({
    status: 200,
    description: "Logged in successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or account deactivated",
  })
  async signIn(@Body() loginDto: LoginDto): Promise<ResponseDto> {
    return this.authService.signIn(loginDto.email, loginDto.password);
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new account",
  })
  @ApiResponse({
    status: 201,
    description: "Account created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or validation failed",
  })
  @ApiResponse({
    status: 409,
    description: "Account already exists",
  })
  async signUp(@Body() registerDto: RegisterDto): Promise<ResponseDto> {
    return this.authService.signUp(
      registerDto.email,
      registerDto.name,
      registerDto.surname,
      registerDto.password,
    );
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get current user information",
  })
  @ApiResponse({
    status: 200,
    description: "User information retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid or missing token",
  })
  async getCurrentUser(
    @Req() request: Request & { user: { email: string } },
  ): Promise<UserResponseDto> {
    return this.authService.validateToken({
      email: request.user.email,
      sub: request.user.email,
    });
  }

  @Get("google/available")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Check if Google OAuth is available",
  })
  @ApiResponse({
    status: 200,
    description: "Google OAuth availability status",
  })
  googleAvailable() {
    const isAvailable =
      process.env.GOOGLE_CLIENT_ID !== undefined &&
      process.env.GOOGLE_CLIENT_ID !== "" &&
      process.env.GOOGLE_CLIENT_SECRET !== undefined &&
      process.env.GOOGLE_CLIENT_SECRET !== "";
    return { available: isAvailable };
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({
    summary: "Initiate Google OAuth login",
  })
  @ApiResponse({
    status: 302,
    description: "Redirects to Google OAuth",
  })
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async googleAuth() {}

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({
    summary: "Handle Google OAuth callback",
  })
  @ApiResponse({
    status: 302,
    description: "Redirects to frontend with token or error",
  })
  async googleAuthRedirect(
    @Req() request: Request & { user: unknown },
    @Res() response: Response,
  ) {
    try {
      const googleUser = request.user as {
        googleId: string;
        email: string;
        name?: string;
        surname?: string;
        picture?: string;
      };

      const result = await this.authService.googleLogin(googleUser);

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      response.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch (error) {
      console.error("Google auth error:", error);
      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      response.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
}
