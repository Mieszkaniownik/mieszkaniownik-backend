import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationService } from "./notification.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new notification",
  })
  @ApiResponse({
    status: 201,
    description: "Notification created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or validation failed",
  })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved all notifications successfully",
  })
  async findAll() {
    return this.notificationService.findAll();
  }

  @Get("my")
  @ApiOperation({
    summary: "Get current user's notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved user notifications successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async findMy(@Request() request: { user: { userId: number } }) {
    return this.notificationService.findByUser(request.user.userId);
  }

  @Get("stats")
  @ApiOperation({
    summary: "Get notification statistics",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved notification statistics successfully",
  })
  async getStats() {
    return this.notificationService.getStats();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a specific notification by ID",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved notification successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Notification not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.notificationService.findOne(id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete a notification",
  })
  @ApiResponse({
    status: 200,
    description: "Notification deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Notification not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.notificationService.remove(id);
  }

  @Post(":id/retry")
  @ApiOperation({
    summary: "Retry a failed notification",
  })
  @ApiResponse({
    status: 200,
    description: "Notification retry initiated successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Notification not found",
  })
  async retry(@Param("id", ParseIntPipe) id: number) {
    return this.notificationService.retryFailed(id);
  }

  @Post("cleanup")
  @ApiOperation({
    summary: "Cleanup old notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Cleanup completed successfully",
  })
  async cleanup(@Query("days", ParseIntPipe) days = 30) {
    return this.notificationService.cleanup(days);
  }
}
