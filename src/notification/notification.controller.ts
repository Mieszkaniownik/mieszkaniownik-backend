import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new notification',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation failed',
  })
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved all notifications successfully',
  })
  findAll() {
    return this.notificationService.findAll();
  }

  @Get('my')
  @ApiOperation({
    summary: "Get current user's notifications",
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved user notifications successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  findMy(@Request() req: { user: { userId: number } }) {
    return this.notificationService.findByUser(req.user.userId);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get notification statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved notification statistics successfully',
  })
  getStats() {
    return this.notificationService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific notification by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved notification successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a notification',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.remove(id);
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Retry a failed notification',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification retry initiated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.retryFailed(id);
  }

  @Post('cleanup')
  @ApiOperation({
    summary: 'Cleanup old notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
  })
  cleanup(@Query('days', ParseIntPipe) days: number = 30) {
    return this.notificationService.cleanup(days);
  }
}
