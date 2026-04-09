import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './tenant/tenant.module';
import { ProductModule } from './product/product.module';
import { Tenant } from './tenant/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'multitenant',
      entities: [Tenant],
      synchronize: true,
      logging: process.env.NODE_ENV !== 'production',
    }),
    TenantModule,
    ProductModule,
  ],
})
export class AppModule {}
