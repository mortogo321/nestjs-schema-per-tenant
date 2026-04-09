/**
 * Product entity definition.
 *
 * Note: This entity is NOT registered with TypeORM's global entity list
 * because the products table lives in tenant-specific schemas, not in
 * the public schema. All product queries go through raw SQL or the
 * tenant-scoped EntityManager from TenantConnectionProvider.
 */
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  sku?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  sku?: string;
}
