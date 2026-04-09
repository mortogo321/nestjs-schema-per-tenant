import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Provides a tenant-scoped EntityManager by setting the PostgreSQL
 * search_path to the current tenant's schema before returning.
 *
 * This ensures all queries executed through the returned EntityManager
 * are automatically scoped to the correct tenant schema.
 */
@Injectable()
export class TenantConnectionProvider {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Returns an EntityManager with search_path set to the current tenant's schema.
   * Must be called within an active TenantContext (i.e., after TenantMiddleware).
   */
  async getEntityManager(): Promise<EntityManager> {
    const tenant = TenantContext.getOrFail();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(
      `SET search_path TO "${tenant.schemaName}", public`,
    );

    return queryRunner.manager;
  }

  /**
   * Execute a callback within a tenant-scoped transaction.
   * The search_path is set before the transaction begins, and the
   * query runner is properly released after completion.
   */
  async withTransaction<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const tenant = TenantContext.getOrFail();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(
      `SET search_path TO "${tenant.schemaName}", public`,
    );
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
