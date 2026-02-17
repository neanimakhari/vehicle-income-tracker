import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './e2e-helpers';

describe('API Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Platform endpoints (require platform admin JWT)', () => {
    it('GET /v1/tenants returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenants')
        .expect(401);
    });

    it('POST /v1/tenants returns 401 without auth', () => {
      return request(app.getHttpServer())
        .post('/v1/tenants')
        .send({ name: 'Test', slug: 'test-tenant' })
        .expect(401);
    });

    it('GET /v1/platform/defaults returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/platform/defaults')
        .expect(401);
    });

    it('GET /v1/platform/audit returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/platform/audit')
        .expect(401);
    });
  });

  describe('Tenant-scoped endpoints (require X-Tenant-ID + tenant auth)', () => {
    it('GET /v1/tenant/incomes returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/incomes')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });

    it('GET /v1/tenant/vehicles returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/vehicles')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });

    it('GET /v1/tenant/users returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/users')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });

    it('GET /v1/tenant/reports/summary returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/reports/summary')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });

    it('GET /v1/tenant/audit returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/audit')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });
  });

  describe('Tenant drivers (nested route)', () => {
    it('GET /v1/tenant/drivers/profile returns 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/v1/tenant/drivers/profile')
        .set('X-Tenant-ID', 'demo')
        .expect(401);
    });
  });
});

