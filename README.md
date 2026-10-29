# NestJS Schema-Per-Tenant Multi-Tenancy

A proof-of-concept demonstrating PostgreSQL **schema-per-tenant** isolation with NestJS, TypeORM, and Fastify.

## Architecture

```
                         +------------------+
                         |   Client / curl  |
                         | X-Tenant-ID: ... |
                         +--------+---------+
                                  |
                         +--------v---------+
                         |  Fastify (3000)  |
                         +--------+---------+
                                  |
                    +-------------v--------------+
                    |    TenantMiddleware         |
                    |  1. Extract X-Tenant-ID     |
                    |  2. Lookup public.tenants   |
                    |  3. SET search_path TO ...  |
                    |  4. Wrap in TenantContext   |
                    +-------------+--------------+
                                  |
              +-------------------+-------------------+
              |                                       |
    +---------v----------+               +------------v-----------+
    |  TenantController  |               |  ProductController     |
    |  POST /tenants     |               |  GET  /products        |
    |  GET  /tenants     |               |  GET  /products/:id    |
    |  DELETE /tenants/  |               |  POST /products        |
    |                    |               |  PATCH /products/:id   |
    |  (no middleware)   |               |  DELETE /products/:id  |
    +--------------------+               +------------+-----------+
                                                      |
                                         +------------v-----------+
                                         | TenantConnectionProvider|
                                         | AsyncLocalStorage ctx  |
                                         +------------+-----------+
                                                      |
                              +-------------------------------------------+
                              |              PostgreSQL                    |
                              |                                           |
                              |  public schema        tenant_acme_corp    |
                              |  +--------------+     +----------------+  |
                              |  | tenants      |     | products       |  |
                              |  | - id         |     | - id           |  |
                              |  | - name       |     | - name         |  |
                              |  | - schema_name|     | - description  |  |
                              |  | - created_at |     | - price        |  |
                              |  +--------------+     | - sku          |  |
                              |                       | - created_at   |  |
                              |  tenant_globex_inc    | - updated_at   |  |
                              |  +----------------+   +----------------+  |
                              |  | products       |                       |
                              |  +----------------+                       |
                              +-------------------------------------------+
```

### Request Flow

1. Client sends request with `X-Tenant-ID` header
2. `TenantMiddleware` resolves the tenant from `public.tenants`
3. PostgreSQL `search_path` is set to the tenant's schema
4. `AsyncLocalStorage` stores the tenant context for the request lifecycle
5. `TenantConnectionProvider` returns a scoped `EntityManager` that operates within the tenant schema
6. Complete schema isolation -- Tenant A cannot see Tenant B's data

## Multi-Tenancy Strategy Comparison

| Criteria              | Schema-per-Tenant (this POC)         | Row-Level (shared table)       | Database-per-Tenant            |
| --------------------- | ------------------------------------ | ------------------------------ | ------------------------------ |
| **Isolation**         | Strong -- separate PG schemas        | Weak -- WHERE tenant_id = ?    | Strongest -- separate databases|
| **Complexity**        | Medium -- middleware + search_path   | Low -- global scope / RLS      | High -- connection management  |
| **Scalability**       | ~100-1,000 tenants                   | Thousands+ tenants             | Hundreds (limited by PG conns) |
| **Migrations**        | Must iterate per schema              | Single migration               | Must iterate per database      |
| **Cross-tenant query**| Possible via schema-qualified SQL    | Easy with WHERE clause         | Requires FDW or app-level join |
| **Backup/restore**    | Per-schema pg_dump possible          | Shared -- harder to isolate    | Independent backups            |
| **Performance**       | Good -- standard PG performance      | Needs indexes on tenant_id     | Good -- dedicated resources    |
| **Cost**              | Single DB instance                   | Single DB instance             | Instance per tenant (expensive)|
| **Best for**          | B2B SaaS, moderate tenant count      | High-volume consumer apps      | Enterprise / compliance-heavy  |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 26+ (for local development)

### Run with Docker Compose

```bash
docker compose up -d
```

This starts PostgreSQL 18 and the NestJS application. The seed script creates a sample tenant "Acme Corp" with three products.

### Run Locally (development)

```bash
# Start only PostgreSQL
docker compose up -d postgres

# Install dependencies and start dev server
bun install
bun run start:dev
```

## API Testing with curl

### Tenant Management

```bash
# Create a new tenant (creates schema + products table)
curl -s -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Globex Inc"}' | jq

# List all tenants
curl -s http://localhost:3000/tenants | jq

# Delete a tenant (drops schema CASCADE)
curl -s -X DELETE http://localhost:3000/tenants/<TENANT_ID>
```

### Product CRUD (requires X-Tenant-ID header)

Use the seeded Acme Corp tenant ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

```bash
# List products for a tenant
curl -s http://localhost:3000/products \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" | jq

# Create a product
curl -s -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{"name": "Turbo Gizmo", "description": "Next-gen gizmo", "price": 99.99, "sku": "GIZ-TRB-001"}' | jq

# Get a single product
curl -s http://localhost:3000/products/<PRODUCT_ID> \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" | jq

# Update a product
curl -s -X PATCH http://localhost:3000/products/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{"price": 79.99}' | jq

# Delete a product
curl -s -X DELETE http://localhost:3000/products/<PRODUCT_ID> \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Verify Tenant Isolation

```bash
# Create a second tenant
curl -s -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Globex Inc"}' | jq

# Use the returned ID to add a product to Globex
curl -s -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: <GLOBEX_TENANT_ID>" \
  -d '{"name": "Globex Widget", "price": 55.00}' | jq

# List Globex products -- only sees Globex data
curl -s http://localhost:3000/products \
  -H "X-Tenant-ID: <GLOBEX_TENANT_ID>" | jq

# List Acme products -- only sees Acme data
curl -s http://localhost:3000/products \
  -H "X-Tenant-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" | jq
```

### Error Handling

```bash
# Missing X-Tenant-ID header -> 400
curl -s http://localhost:3000/products | jq

# Invalid tenant ID -> 404
curl -s http://localhost:3000/products \
  -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000000" | jq
```

## Project Structure

```
src/
  main.ts                              # Fastify bootstrap
  app.module.ts                        # Root module with TypeORM config
  tenant/
    tenant-context.ts                  # AsyncLocalStorage-based context
    tenant.entity.ts                   # public.tenants entity
    tenant.middleware.ts               # X-Tenant-ID resolution + search_path
    tenant.module.ts                   # Module with middleware config
    tenant.service.ts                  # Schema lifecycle (create/drop)
    tenant.controller.ts               # REST endpoints
  product/
    product.entity.ts                  # Product type definitions
    product.module.ts                  # Module importing TenantModule
    product.service.ts                 # Tenant-scoped CRUD
    product.controller.ts              # REST endpoints
  database/
    tenant-connection.provider.ts      # Tenant-scoped EntityManager
scripts/
  seed.sql                            # Initial schema + sample data
```

## Key Design Decisions

- **AsyncLocalStorage** over request-scoped providers: avoids per-request DI overhead while still providing tenant context propagation through the call stack
- **Raw SQL for tenant tables**: product tables live in dynamic schemas that TypeORM's entity system cannot discover at compile time, so parameterized raw queries are used instead
- **Transactional schema creation**: tenant provisioning (CREATE SCHEMA + table creation + registry insert) runs in a single transaction to prevent orphaned schemas
- **Middleware exclusion**: tenant management endpoints are excluded from the tenant middleware since they operate on the public schema

## License

MIT
