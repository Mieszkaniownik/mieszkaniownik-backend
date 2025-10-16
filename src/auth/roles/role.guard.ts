import { Role } from '@prisma/client';

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRequest } from '../dto/user-request';
import { ROLES_KEY } from './role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | null>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    console.log('Required roles:', requiredRoles);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request: UserRequest = context.switchToHttp().getRequest();
    console.log('Request user:', request.user);
    if (request.user === undefined || request.user === null) {
      throw new ForbiddenException('User not authenticated');
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
