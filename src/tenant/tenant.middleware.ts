import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext, TenantInfo } from './tenant-context';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): Promise<void> {
    const tenantId = (req as any).headers['x-tenant-id'] as string | undefined;

    if (!tenantId) {
      throw new BadRequestException('X-Tenant-ID header is required');
    }

    const tenant = await this.dataSource
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Set the search_path for this request's queries
    await this.dataSource.query(`SET search_path TO "${tenant.schema_name}", public`);

    const tenantInfo: TenantInfo = {
      id: tenant.id,
      schemaName: tenant.schema_name,
    };

    TenantContext.run(tenantInfo, () => {
      next();
    });
  }
}
