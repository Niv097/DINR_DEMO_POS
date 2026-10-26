import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@nodedr-restaurant/types';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const PERMISSIONS_ANY_KEY = 'requiredAnyPermissions';

// Usage: @RequirePermission('menu.manage') on any controller method.
// PermissionsGuard reads this metadata and checks it against the caller's
// role-derived permission set — never a hardcoded role check in the handler.
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireAnyPermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
