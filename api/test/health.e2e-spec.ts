import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './e2e-helpers';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/health returns ok', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(res => {
        expect(res.body).toBeDefined();
        expect(res.body.status).toBeDefined();
      });
  });

  it('GET /v1/health/detailed returns detailed status', () => {
    return request(app.getHttpServer())
      .get('/v1/health/detailed')
      .expect(200)
      .expect(res => {
        expect(res.body).toBeDefined();
      });
  });
});

