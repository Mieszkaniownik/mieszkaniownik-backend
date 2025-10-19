import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { UserRequest } from "../auth/dto/user-request";
import { AlertService } from "./alert.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { QueryAlertsDto } from "./dto/query-alerts.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";

@ApiTags("alerts")
@ApiBearerAuth()
@Controller("alerts")
@UseGuards(AuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new alert",
  })
  @ApiResponse({
    status: 201,
    description: "Alert created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or validation failed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async create(
    @Request() request: UserRequest,
    @Body() createAlertDto: CreateAlertDto,
  ) {
    return this.alertService.create(request.user.id, createAlertDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all alerts for current user",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved alerts successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async findAll(
    @Request() request: UserRequest,
    @Query() query: QueryAlertsDto,
  ) {
    return this.alertService.findAll(request.user.id, query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a specific alert by ID",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved alert successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Alert not found",
  })
  async findOne(
    @Request() request: UserRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.alertService.findOne(id, request.user.id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update an alert",
  })
  @ApiResponse({
    status: 200,
    description: "Alert updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or validation failed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Alert not found",
  })
  async update(
    @Request() request: UserRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() updateAlertDto: UpdateAlertDto,
  ) {
    return this.alertService.update(id, request.user.id, updateAlertDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete an alert",
  })
  @ApiResponse({
    status: 200,
    description: "Alert deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Alert not found",
  })
  async remove(
    @Request() request: UserRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.alertService.remove(id, request.user.id);
  }

  @Patch(":id/toggle")
  @ApiOperation({
    summary: "Toggle alert status",
  })
  @ApiResponse({
    status: 200,
    description: "Alert status toggled successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Alert not found",
  })
  async toggleStatus(
    @Request() request: UserRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.alertService.toggleStatus(id, request.user.id);
  }
}
