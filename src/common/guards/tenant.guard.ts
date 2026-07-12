import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { TenantContext } from '../../tenant/tenant-context';

/**
 * Guard that ensures a valid tenant context is present.
 * Use on routes that require tenant isolation.
 * Returns 403 if no tenant context is found.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(_context: ExecutionContext): boolean {
    const tenant = TenantContext.get();

    if (!tenant) {
      this.logger.warn('Request rejected: no tenant context found');
      throw new ForbiddenException('Tenant context is required to access this resource');
    }

    return true;
  }
}
