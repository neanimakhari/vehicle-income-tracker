import { describe, expect, it } from 'vitest';
import { TrackingEventsService } from './tracking-events.service';

describe('TrackingEventsService.computeOverspeed', () => {
  const svc = Object.create(TrackingEventsService.prototype) as TrackingEventsService;

  it('flags overspeed from speed vs limit', () => {
    expect(
      svc.computeOverspeed({ speedKph: 72, alarmFlags: 0, limitKph: 60 }),
    ).toBe(true);
    expect(
      svc.computeOverspeed({ speedKph: 55, alarmFlags: 0, limitKph: 60 }),
    ).toBe(false);
  });

  it('flags overspeed from JT808 alarm bit 1', () => {
    expect(
      svc.computeOverspeed({ speedKph: 0, alarmFlags: 1 << 1, limitKph: 60 }),
    ).toBe(true);
  });

  it('flags overspeed from warning bit 13', () => {
    expect(
      svc.computeOverspeed({ speedKph: 10, alarmFlags: 1 << 13, limitKph: 120 }),
    ).toBe(true);
  });
});
