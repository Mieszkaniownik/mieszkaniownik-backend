import { IsEnum, IsOptional } from 'class-validator';
import { SortOrder } from '../scraper.service';

export class ScrapeRequestDto {
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.NEWEST;
}
