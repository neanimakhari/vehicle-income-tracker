import { ConfigService } from '@nestjs/config';
import { OneSignalClient } from './onesignal.client';

describe('OneSignalClient', () => {
  it('skips when not configured', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'onesignal.enabled') return true;
        if (key === 'onesignal.appId') return '';
        if (key === 'onesignal.restApiKey') return '';
        return undefined;
      },
    } as ConfigService;
    const client = new OneSignalClient(config);
    const res = await client.send({
      title: 'Hi',
      message: 'Test',
      externalIds: ['user-1'],
    });
    expect(res.skipped).toBe(true);
    expect(res.configured).toBe(false);
    expect(res.reason).toMatch(/not set/i);
  });

  it('skips when disabled even if keys present', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'onesignal.enabled') return false;
        if (key === 'onesignal.appId') return 'app-id';
        if (key === 'onesignal.restApiKey') return 'rest-key';
        return undefined;
      },
    } as ConfigService;
    const client = new OneSignalClient(config);
    const res = await client.send({
      title: 'Hi',
      message: 'Test',
      externalIds: ['user-1'],
    });
    expect(res.skipped).toBe(true);
    expect(res.configured).toBe(true);
    expect(res.enabled).toBe(false);
  });
});
