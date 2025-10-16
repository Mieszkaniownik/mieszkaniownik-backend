import type { Request } from 'express';

import type { DatabaseStatsDto } from './database-stats.dto';

export interface DatabaseRequest extends Request {
  database?: DatabaseStatsDto;
}
