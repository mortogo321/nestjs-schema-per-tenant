import { Module, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantMiddleware } from './tenant.middleware';
import { TenantConnectionProvider } from '../database/tenant-connection.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [TenantController],
  providers: [TenantService, TenantConnectionProvider],
  exports: [TenantService, TenantConnectionProvider],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'tenants', method: RequestMethod.POST },
        { path: 'tenants', method: RequestMethod.GET },
        { path: 'tenants/(.*)', method: RequestMethod.DELETE },
      )
      .forRoutes('*');
  }
}
