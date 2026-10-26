import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  permissionSatisfied,
  type PermissionKey,
} from '@nodedr-restaurant/types';
import { PERMISSIONS_KEY, PERMISSIONS_ANY_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyRequired = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    if (required && required.length > 0) {
      const hasAll = required.every((permission) =>
        permissionSatisfied(user.permissions, permission),
      );
      if (!hasAll) {
        throw new ForbiddenException(
          `Missing permission: ${required.join(', ')}`,
        );
      }
    }

    if (anyRequired && anyRequired.length > 0) {
      const hasAny = anyRequired.some((permission) =>
        permissionSatisfied(user.permissions, permission),
      );
      if (!hasAny) {
        throw new ForbiddenException(
          `Missing one of required permissions: ${anyRequired.join(', ')}`,
        );
      }
    }

    return true;
  }
}
