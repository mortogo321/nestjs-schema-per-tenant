import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { TenantController } from '../src/tenant/tenant.controller';
import { TenantService } from '../src/tenant/tenant.service';

describe('Tenants API (e2e smoke)', () => {
  let app: NestFastifyApplication;
  const tenants = [{ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'Acme Corp' }];

  beforeAll(async () => {
    // The database-bound TenantService is mocked so the suite runs without Postgres.
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        {
          provide: TenantService,
          useValue: { getTenants: jest.fn().mockResolvedValue(tenants) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tenants returns the tenant list', async () => {
    const res = await request(app.getHttpServer()).get('/tenants').expect(200);
    expect(res.body).toEqual(tenants);
  });

  it('POST /tenants rejects an invalid body', async () => {
    await request(app.getHttpServer()).post('/tenants').send({}).expect(400);
  });
});
