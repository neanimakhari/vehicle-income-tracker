import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './e2e-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Platform auth /v1/auth', () => {
    it('POST /v1/auth/login rejects empty body with 400', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({})
        .expect(400);
    });

    it('POST /v1/auth/login rejects invalid email with 400', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'not-an-email', password: 'ValidPass123!' })
        .expect(400);
    });

    it('POST /v1/auth/login rejects short password with 400', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'short' })
        .expect(400);
    });

    it('POST /v1/auth/login with valid format returns 4xx or 5xx for unknown creds', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'ValidPassword123!' })
        .expect(res => {
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.status).toBeLessThan(600);
        });
    });

    it('POST /v1/auth/refresh rejects empty body with 400', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('Tenant auth /v1/tenant/auth', () => {
    it('POST /v1/tenant/auth/login requires X-Tenant-ID or rejects invalid body', () => {
      return request(app.getHttpServer())
        .post('/v1/tenant/auth/login')
        .set('X-Tenant-ID', 'demo')
        .send({})
        .expect(400);
    });

    it('POST /v1/tenant/auth/login validates email', () => {
      return request(app.getHttpServer())
        .post('/v1/tenant/auth/login')
        .set('X-Tenant-ID', 'demo')
        .send({ email: 'bad', password: 'ValidPass123!' })
        .expect(400);
    });
  });
});

