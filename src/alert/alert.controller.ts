import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { UserRequest } from '../auth/dto/user-request';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(AuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new alert',
  })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  create(@Request() req: UserRequest, @Body() createAlertDto: CreateAlertDto) {
    return this.alertService.create(Number(req.user.id), createAlertDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all alerts for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved alerts successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  findAll(@Request() req: UserRequest, @Query() query: QueryAlertsDto) {
    return this.alertService.findAll(Number(req.user.id), query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific alert by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved alert successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  findOne(@Request() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.alertService.findOne(id, Number(req.user.id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an alert',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  update(
    @Request() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAlertDto: UpdateAlertDto,
  ) {
    return this.alertService.update(
      id,

      Number(req.user.id),
      updateAlertDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an alert',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  remove(@Request() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.alertService.remove(id, Number(req.user.id));
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: 'Toggle alert status (active/inactive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert status toggled successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  toggleStatus(
    @Request() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.alertService.toggleStatus(id, Number(req.user.id));
  }
}
