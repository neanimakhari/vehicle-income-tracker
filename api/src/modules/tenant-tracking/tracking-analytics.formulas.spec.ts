import {
  computeDayRollup,
  johannesburgDayBounds,
  reconcileDay,
  TrackingSample,
} from './tracking-analytics.formulas';

describe('tracking-analytics.formulas', () => {
  const base = new Date('2026-09-19T08:00:00+02:00');

  function sample(
    i: number,
    overrides: Partial<TrackingSample> = {},
  ): TrackingSample {
    return {
      recordedAt: new Date(base.getTime() + i * 10_000),
      latitude: -26.2 + i * 0.001,
      longitude: 28.05,
      speedKph: 40,
      ignitionOn: true,
      odometerKm: 1000 + i * 0.1,
      fuelRateLph: 6,
      fuelLevelPercent: 70 - i * 0.1,
      engineRpm: 2000,
      engineLoadPercent: 40,
      coolantC: 90,
      externalVoltage: 13.8,
      backupBatteryLevel: 80,
      gpsFixOk: true,
      satellites: 12,
      overspeed: false,
      source: 'device',
      ...overrides,
    };
  }

  it('computes distance from odometer and estimates litres', () => {
    const samples = Array.from({ length: 30 }, (_, i) => sample(i));
    const r = computeDayRollup(samples);
    expect(r.pointCount).toBe(30);
    expect(r.distanceKm).toBeCloseTo(2.9, 1);
    expect(r.distanceBasis).toBe('odometer');
    expect(r.estimatedLitres).toBeGreaterThan(0);
    expect(r.litresPer100km).not.toBeNull();
    expect(r.confidence).not.toBe('unavailable');
  });

  it('excludes simulate by default', () => {
    const samples = [
      sample(0, { source: 'simulate' }),
      sample(1, { source: 'simulate' }),
    ];
    expect(computeDayRollup(samples).pointCount).toBe(0);
    expect(computeDayRollup(samples, { includeSimulate: true }).pointCount).toBe(
      2,
    );
  });

  it('flags distance under-reporting on reconcile', () => {
    const rollup = computeDayRollup(
      Array.from({ length: 40 }, (_, i) => sample(i)),
    );
    const rec = reconcileDay(rollup, {
      incomeTotal: 200,
      petrolLitres: 1,
      petrolRand: 25,
      distanceKm: 1,
      entryCount: 1,
    });
    expect(rec.flags).toContain('DISTANCE_UNDER');
    expect(rec.incomePerKm).not.toBeNull();
  });

  it('parses Johannesburg day bounds as UTC+2', () => {
    const { from, to } = johannesburgDayBounds('2026-09-19');
    expect(from.toISOString()).toBe('2026-09-18T22:00:00.000Z');
    expect(to.toISOString()).toBe('2026-09-19T21:59:59.999Z');
  });
});
