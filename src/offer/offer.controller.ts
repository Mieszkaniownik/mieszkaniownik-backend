import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles/role.decorator';
import { Role } from '@prisma/client';

@ApiTags('offers')
@Controller('offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new offer' })
  @ApiResponse({ status: 201, description: 'Offer created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Offer with this link already exists',
  })
  create(@Body() createOfferDto: CreateOfferDto) {
    return this.offerService.create(createOfferDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all offers' })
  @ApiResponse({ status: 200, description: 'Returns all offers' })
  findAll() {
    return this.offerService.findAll();
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get offer statistics' })
  @ApiResponse({ status: 200, description: 'Returns offer statistics' })
  getStatistics() {
    return this.offerService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single offer by ID' })
  @ApiResponse({ status: 200, description: 'Returns the offer' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  findOne(@Param('id') id: string) {
    return this.offerService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an offer' })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  update(@Param('id') id: string, @Body() updateOfferDto: UpdateOfferDto) {
    return this.offerService.update(+id, updateOfferDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete an offer' })
  @ApiResponse({ status: 200, description: 'Offer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  remove(@Param('id') id: string) {
    return this.offerService.remove(+id);
  }

  @Patch(':id/unavailable')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark an offer as unavailable' })
  @ApiResponse({ status: 200, description: 'Offer marked as unavailable' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  markUnavailable(@Param('id') id: string) {
    return this.offerService.markAsUnavailable(+id);
  }

  @Delete('expired/cleanup')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete expired offers' })
  @ApiResponse({ status: 200, description: 'Expired offers deleted' })
  deleteExpired() {
    return this.offerService.deleteExpiredOffers();
  }
}
