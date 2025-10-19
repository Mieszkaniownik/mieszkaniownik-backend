import type { Request } from "express";

import type { UserResponseDto } from "../../user/dto/user-response.dto";

export interface UserRequest extends Request {
  user: UserResponseDto;
}
