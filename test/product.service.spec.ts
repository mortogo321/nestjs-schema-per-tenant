import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from '../src/product/product.service';
import { TenantConnectionProvider } from '../src/database/tenant-connection.provider';

describe('ProductService', () => {
  let service: ProductService;

  const mockEntityManager = {
    query: jest.fn(),
  };

  const mockTenantConnection = {
    getEntityManager: jest.fn().mockResolvedValue(mockEntityManager),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: TenantConnectionProvider,
          useValue: mockTenantConnection,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);

    jest.clearAllMocks();
    mockTenantConnection.getEntityManager.mockResolvedValue(mockEntityManager);
  });

  describe('findAll', () => {
    it('should return all products from the tenant schema', async () => {
      const products = [
        { id: 'p1', name: 'Widget', price: 9.99 },
        { id: 'p2', name: 'Gadget', price: 19.99 },
      ];
      mockEntityManager.query.mockResolvedValue(products);

      const result = await service.findAll();

      expect(result).toEqual(products);
      expect(mockTenantConnection.getEntityManager).toHaveBeenCalled();
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      const product = { id: 'p1', name: 'Widget', price: 9.99 };
      mockEntityManager.query.mockResolvedValue([product]);

      const result = await service.findOne('p1');

      expect(result).toEqual(product);
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['p1'],
      );
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockEntityManager.query.mockResolvedValue([]);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should insert a product and return it', async () => {
      const input = { name: 'New Product', price: 29.99, sku: 'NP-001' };
      const created = {
        id: 'p3',
        ...input,
        description: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockEntityManager.query.mockResolvedValue([created]);

      const result = await service.create(input);

      expect(result).toEqual(created);
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        [input.name, null, input.price, input.sku],
      );
    });
  });

  describe('update', () => {
    it('should update product fields and return updated product', async () => {
      const existing = { id: 'p1', name: 'Old Name', price: 9.99 };
      const updated = { id: 'p1', name: 'New Name', price: 9.99 };

      // First call is findOne (verify exists), second call is the UPDATE
      mockEntityManager.query
        .mockResolvedValueOnce([existing]) // findOne check
        .mockResolvedValueOnce([updated]); // update query

      const result = await service.update('p1', { name: 'New Name' });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when updating non-existent product', async () => {
      mockEntityManager.query.mockResolvedValue([]);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a product by ID', async () => {
      const existing = { id: 'p1', name: 'Widget', price: 9.99 };

      mockEntityManager.query
        .mockResolvedValueOnce([existing]) // findOne check
        .mockResolvedValueOnce(undefined); // DELETE

      await service.remove('p1');

      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM products WHERE id = $1'),
        ['p1'],
      );
    });

    it('should throw NotFoundException when deleting non-existent product', async () => {
      mockEntityManager.query.mockResolvedValue([]);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
