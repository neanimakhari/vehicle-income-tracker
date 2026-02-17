import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './e2e-helpers';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/ returns hello', () => {
    return request(app.getHttpServer())
      .get('/v1/')
      .expect(200)
      .expect(res => expect(res.text).toContain('Hello'));
  });
});
