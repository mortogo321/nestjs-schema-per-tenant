import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createTenant(name: string): Promise<Tenant> {
    const schemaName = this.toSchemaName(name);

    const existing = await this.tenantRepo.findOne({
      where: { schema_name: schemaName },
    });

    if (existing) {
      throw new ConflictException(`Tenant schema "${schemaName}" already exists`);
    }

    // Create the schema and its tables within a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create the tenant schema
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create the products table inside the tenant schema
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(12, 2) NOT NULL DEFAULT 0,
          sku VARCHAR(100),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Save the tenant record in public.tenants
      const tenant = this.tenantRepo.create({
        name,
        schema_name: schemaName,
      });
      const saved = await queryRunner.manager.save(tenant);

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTenants(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { created_at: 'DESC' } });
  }

  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Drop the entire schema and all its objects
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`);

      // Remove tenant record
      await queryRunner.manager.remove(tenant);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Convert a tenant name to a safe PostgreSQL schema name.
   * "Acme Corp" -> "tenant_acme_corp"
   */
  private toSchemaName(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `tenant_${slug}`;
  }
}
