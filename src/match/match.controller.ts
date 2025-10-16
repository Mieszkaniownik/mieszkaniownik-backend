import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MatchService } from './match.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { UserRequest } from '../auth/dto/user-request';

@ApiTags('matches')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(AuthGuard)
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new match',
  })
  @ApiResponse({
    status: 201,
    description: 'Match created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchService.create(createMatchDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all matches for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved user matches successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  findAllByUser(@Request() req: UserRequest, @Query() query: QueryMatchesDto) {
    return this.matchService.findAllByUser(Number(req.user.id), query);
  }

  @Get('alert/:alertId')
  @ApiOperation({
    summary: 'Get all matches for a specific alert',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved alert matches successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  findAllByAlert(
    @Request() req: UserRequest,
    @Param('alertId', ParseIntPipe) alertId: number,
  ) {
    return this.matchService.findAllByAlert(alertId, Number(req.user.id));
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get match statistics for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved match statistics successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getMatchStats(@Request() req: UserRequest) {
    return this.matchService.getMatchStats(Number(req.user.id));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific match by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Retrieved match successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  findOne(@Request() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.matchService.findOne(id, Number(req.user.id));
  }

  @Post('process-offer/:offerId')
  @ApiOperation({
    summary: 'Process a new offer and create matches',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
  })
  processOffer(@Param('offerId', ParseIntPipe) offerId: number) {
    return this.matchService.processNewOffer(offerId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a match',
  })
  @ApiResponse({
    status: 200,
    description: 'Match deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  remove(@Request() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.matchService.remove(id, Number(req.user.id));
  }
}
