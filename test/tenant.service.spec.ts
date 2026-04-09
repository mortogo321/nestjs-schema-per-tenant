import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { TenantService } from '../src/tenant/tenant.service';
import { Tenant } from '../src/tenant/tenant.entity';

describe('TenantService', () => {
  let service: TenantService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      save: jest.fn(),
      remove: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockTenantRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepo,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);

    jest.clearAllMocks();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  describe('createTenant', () => {
    it('should create a tenant with the correct schema name', async () => {
      const tenantName = 'Acme Corp';
      const expectedSchema = 'tenant_acme_corp';

      mockTenantRepo.findOne.mockResolvedValue(null);
      mockTenantRepo.create.mockReturnValue({
        name: tenantName,
        schema_name: expectedSchema,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'uuid-1',
        name: tenantName,
        schema_name: expectedSchema,
        created_at: new Date(),
      });

      const result = await service.createTenant(tenantName);

      expect(result.schema_name).toBe(expectedSchema);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(`CREATE SCHEMA IF NOT EXISTS "${expectedSchema}"`),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw ConflictException if schema already exists', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        name: 'Acme Corp',
        schema_name: 'tenant_acme_corp',
      });

      await expect(service.createTenant('Acme Corp')).rejects.toThrow(ConflictException);
    });

    it('should rollback transaction on error', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      mockTenantRepo.create.mockReturnValue({ name: 'Test', schema_name: 'tenant_test' });
      mockQueryRunner.query.mockRejectedValue(new Error('DB error'));

      await expect(service.createTenant('Test')).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getTenants', () => {
    it('should return all tenants ordered by created_at DESC', async () => {
      const tenants = [
        { id: '1', name: 'Tenant B', schema_name: 'tenant_b', created_at: new Date() },
        { id: '2', name: 'Tenant A', schema_name: 'tenant_a', created_at: new Date() },
      ];
      mockTenantRepo.find.mockResolvedValue(tenants);

      const result = await service.getTenants();

      expect(result).toEqual(tenants);
      expect(mockTenantRepo.find).toHaveBeenCalledWith({ order: { created_at: 'DESC' } });
    });
  });

  describe('deleteTenant', () => {
    it('should drop schema and remove tenant record', async () => {
      const tenant = { id: 'uuid-1', name: 'Acme', schema_name: 'tenant_acme' };
      mockTenantRepo.findOne.mockResolvedValue(tenant);

      await service.deleteTenant('uuid-1');

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP SCHEMA IF EXISTS "tenant_acme" CASCADE'),
      );
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(tenant);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tenant does not exist', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteTenant('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should rollback transaction on error', async () => {
      const tenant = { id: 'uuid-1', name: 'Acme', schema_name: 'tenant_acme' };
      mockTenantRepo.findOne.mockResolvedValue(tenant);
      mockQueryRunner.query.mockRejectedValue(new Error('Drop failed'));

      await expect(service.deleteTenant('uuid-1')).rejects.toThrow('Drop failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
