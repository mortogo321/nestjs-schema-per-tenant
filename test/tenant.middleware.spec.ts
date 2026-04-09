import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TenantMiddleware } from '../src/tenant/tenant.middleware';
import { Tenant } from '../src/tenant/tenant.entity';
import { TenantContext } from '../src/tenant/tenant-context';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  const mockDataSource = {
    getRepository: jest.fn(),
    query: jest.fn(),
  };

  const mockTenantRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    mockDataSource.getRepository.mockReturnValue(mockTenantRepo);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);

    jest.clearAllMocks();
    mockDataSource.getRepository.mockReturnValue(mockTenantRepo);
  });

  function createMockReq(headers: Record<string, string> = {}) {
    return { headers } as any;
  }

  function createMockRes() {
    return {} as any;
  }

  it('should throw BadRequestException when X-Tenant-ID header is missing', async () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = jest.fn();

    await expect(middleware.use(req, res, next)).rejects.toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when tenant ID is invalid / not found', async () => {
    const req = createMockReq({ 'x-tenant-id': 'nonexistent-uuid' });
    const res = createMockRes();
    const next = jest.fn();

    mockTenantRepo.findOne.mockResolvedValue(null);

    await expect(middleware.use(req, res, next)).rejects.toThrow(NotFoundException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should set search_path and call next() for a valid tenant', async () => {
    const tenant: Partial<Tenant> = {
      id: 'valid-uuid',
      name: 'Acme Corp',
      schema_name: 'tenant_acme_corp',
    };

    mockTenantRepo.findOne.mockResolvedValue(tenant);
    mockDataSource.query.mockResolvedValue(undefined);

    const req = createMockReq({ 'x-tenant-id': 'valid-uuid' });
    const res = createMockRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockDataSource.query).toHaveBeenCalledWith(
      'SET search_path TO "tenant_acme_corp", public',
    );
    expect(next).toHaveBeenCalled();
  });

  it('should store the tenant info in TenantContext', async () => {
    const tenant: Partial<Tenant> = {
      id: 'ctx-uuid',
      name: 'Test Tenant',
      schema_name: 'tenant_test_tenant',
    };

    mockTenantRepo.findOne.mockResolvedValue(tenant);
    mockDataSource.query.mockResolvedValue(undefined);

    const req = createMockReq({ 'x-tenant-id': 'ctx-uuid' });
    const res = createMockRes();

    let capturedTenant: any;
    const next = jest.fn(() => {
      capturedTenant = TenantContext.get();
    });

    await middleware.use(req, res, next);

    expect(capturedTenant).toEqual({
      id: 'ctx-uuid',
      schemaName: 'tenant_test_tenant',
    });
  });
});
