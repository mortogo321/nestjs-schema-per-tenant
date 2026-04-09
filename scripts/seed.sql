-- Seed script: runs on first database initialization
-- Creates the public.tenants table and a sample tenant with its schema

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the tenants registry table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a sample tenant
INSERT INTO public.tenants (id, name, schema_name)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Acme Corp', 'tenant_acme_corp')
ON CONFLICT (schema_name) DO NOTHING;

-- Create the tenant schema
CREATE SCHEMA IF NOT EXISTS tenant_acme_corp;

-- Create the products table inside the tenant schema
CREATE TABLE IF NOT EXISTS tenant_acme_corp.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sku VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert sample products for Acme Corp
INSERT INTO tenant_acme_corp.products (name, description, price, sku)
VALUES
    ('Widget Pro', 'Professional-grade widget for enterprise use', 29.99, 'WGT-PRO-001'),
    ('Gadget Lite', 'Lightweight gadget for everyday tasks', 14.50, 'GDG-LIT-001'),
    ('Super Connector', 'High-speed connector with universal compatibility', 49.95, 'CON-SUP-001')
ON CONFLICT DO NOTHING;
