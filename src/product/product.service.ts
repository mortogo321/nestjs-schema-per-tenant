import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantConnectionProvider } from '../database/tenant-connection.provider';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
} from './product.entity';

@Injectable()
export class ProductService {
  constructor(
    private readonly tenantConnection: TenantConnectionProvider,
  ) {}

  async findAll(): Promise<Product[]> {
    const manager = await this.tenantConnection.getEntityManager();
    return manager.query(
      `SELECT id, name, description, price, sku, created_at, updated_at
       FROM products
       ORDER BY created_at DESC`,
    );
  }

  async findOne(id: string): Promise<Product> {
    const manager = await this.tenantConnection.getEntityManager();
    const rows: Product[] = await manager.query(
      `SELECT id, name, description, price, sku, created_at, updated_at
       FROM products
       WHERE id = $1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return rows[0];
  }

  async create(input: CreateProductInput): Promise<Product> {
    const manager = await this.tenantConnection.getEntityManager();
    const rows: Product[] = await manager.query(
      `INSERT INTO products (name, description, price, sku)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, price, sku, created_at, updated_at`,
      [input.name, input.description ?? null, input.price, input.sku ?? null],
    );

    return rows[0];
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    // First verify the product exists
    await this.findOne(id);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.price !== undefined) {
      setClauses.push(`price = $${paramIndex++}`);
      values.push(input.price);
    }
    if (input.sku !== undefined) {
      setClauses.push(`sku = $${paramIndex++}`);
      values.push(input.sku);
    }

    if (setClauses.length === 0) {
      return this.findOne(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const manager = await this.tenantConnection.getEntityManager();
    const rows: Product[] = await manager.query(
      `UPDATE products
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, description, price, sku, created_at, updated_at`,
      values,
    );

    return rows[0];
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const manager = await this.tenantConnection.getEntityManager();
    await manager.query(`DELETE FROM products WHERE id = $1`, [id]);
  }
}
