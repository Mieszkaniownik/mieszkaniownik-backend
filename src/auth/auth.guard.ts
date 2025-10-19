import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";

@Injectable()
export class AuthGuard extends PassportAuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const result = super.canActivate(context);
      return result instanceof Promise ? await result : Boolean(result);
    }

    const result = super.canActivate(context);
    return result instanceof Promise ? await result : Boolean(result);
  }

  handleRequest<T>(
    error: Error | null,
    user: T | false,
    _info: unknown,
    context: ExecutionContext,
  ) {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return user === false ? null : user;
    }

    if (error !== null || user === false) {
      throw error ?? new Error("Unauthorized");
    }
    return user;
  }
}
