/** Pure helpers for tracker daily rollups (unit-tested). */

export type TrackingSample = {
  recordedAt: Date;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  ignitionOn: boolean | null;
  odometerKm: number | null;
  fuelRateLph: number | null;
  fuelLevelPercent: number | null;
  engineRpm: number | null;
  engineLoadPercent: number | null;
  coolantC: number | null;
  externalVoltage: number | null;
  backupBatteryLevel: number | null;
  gpsFixOk: boolean | null;
  satellites: number | null;
  overspeed: boolean | null;
  source?: string | null;
};

export type DayRollupResult = {
  pointCount: number;
  distanceKm: number | null;
  distanceBasis: 'odometer' | 'path' | 'mixed' | 'none';
  movingSeconds: number;
  idleSeconds: number;
  ignitionOnSeconds: number;
  idlePct: number | null;
  utilisationHours: number;
  avgSpeedMoving: number | null;
  maxSpeedKph: number | null;
  stopCount: number;
  estimatedLitres: number | null;
  litresPer100km: number | null;
  kmPerLitre: number | null;
  avgFuelRateMoving: number | null;
  fuelLevelStart: number | null;
  fuelLevelEnd: number | null;
  avgRpmMoving: number | null;
  avgLoadMoving: number | null;
  coolantMax: number | null;
  coolantHotSeconds: number;
  highRpmLowSpeedPct: number | null;
  avgExternalVoltage: number | null;
  minExternalVoltage: number | null;
  lowVoltagePct: number | null;
  avgBackupBattery: number | null;
  gpsFixOkPct: number | null;
  avgSatellites: number | null;
  overspeedSampleCount: number;
  overspeedMovingPct: number | null;
  obdCoveragePct: number;
  confidence: 'high' | 'medium' | 'low' | 'unavailable';
};

const MIN_DT_S = 5;
const MAX_DT_S = 120;
const IDLE_SPEED = 3;
const MAX_PATH_JUMP_KM = 2;
const MAX_ODO_DELTA_KM = 800;
const COOLANT_HOT_C = 100;
const LOW_VOLTAGE = 12;
const HIGH_RPM = 2500;
const LOW_SPEED_FOR_RPM = 20;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function clampDtSeconds(ms: number): number {
  const s = ms / 1000;
  if (s < MIN_DT_S) return MIN_DT_S;
  if (s > MAX_DT_S) return MAX_DT_S;
  return s;
}

export function filterProductionSamples(
  samples: TrackingSample[],
  includeSimulate: boolean,
): TrackingSample[] {
  const filtered = includeSimulate
    ? samples
    : samples.filter((s) => (s.source ?? '') !== 'simulate');
  return filtered
    .slice()
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

export function computeDayRollup(
  samplesIn: TrackingSample[],
  opts?: { includeSimulate?: boolean },
): DayRollupResult {
  const samples = filterProductionSamples(
    samplesIn,
    opts?.includeSimulate ?? false,
  );
  const empty: DayRollupResult = {
    pointCount: 0,
    distanceKm: null,
    distanceBasis: 'none',
    movingSeconds: 0,
    idleSeconds: 0,
    ignitionOnSeconds: 0,
    idlePct: null,
    utilisationHours: 0,
    avgSpeedMoving: null,
    maxSpeedKph: null,
    stopCount: 0,
    estimatedLitres: null,
    litresPer100km: null,
    kmPerLitre: null,
    avgFuelRateMoving: null,
    fuelLevelStart: null,
    fuelLevelEnd: null,
    avgRpmMoving: null,
    avgLoadMoving: null,
    coolantMax: null,
    coolantHotSeconds: 0,
    highRpmLowSpeedPct: null,
    avgExternalVoltage: null,
    minExternalVoltage: null,
    lowVoltagePct: null,
    avgBackupBattery: null,
    gpsFixOkPct: null,
    avgSatellites: null,
    overspeedSampleCount: 0,
    overspeedMovingPct: null,
    obdCoveragePct: 0,
    confidence: 'unavailable',
  };
  if (samples.length === 0) return empty;

  let pathKm = 0;
  let movingSeconds = 0;
  let idleSeconds = 0;
  let ignitionOnSeconds = 0;
  let stopCount = 0;
  let prevWasIdle = false;
  let speedSum = 0;
  let speedN = 0;
  let maxSpeed: number | null = null;
  let litres = 0;
  let litreSeconds = 0;
  let fuelRateSum = 0;
  let fuelRateN = 0;
  let rpmSum = 0;
  let rpmN = 0;
  let loadSum = 0;
  let loadN = 0;
  let coolantMax: number | null = null;
  let coolantHotSeconds = 0;
  let highRpmLowSpeed = 0;
  let movingObdStyle = 0;
  let voltSum = 0;
  let voltN = 0;
  let voltMin: number | null = null;
  let lowVolt = 0;
  let backupSum = 0;
  let backupN = 0;
  let gpsOk = 0;
  let satSum = 0;
  let satN = 0;
  let overspeedMoving = 0;
  let movingSamples = 0;
  let obdHits = 0;

  const odoVals = samples
    .map((s) => s.odometerKm)
    .filter((v): v is number => v != null && Number.isFinite(v));
  let odoDelta: number | null = null;
  if (odoVals.length >= 2) {
    const delta = Math.max(...odoVals) - Math.min(...odoVals);
    if (delta > 0 && delta <= MAX_ODO_DELTA_KM) odoDelta = delta;
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const speed = s.speedKph != null ? Number(s.speedKph) : 0;
    const moving = speed > IDLE_SPEED;
    const idle =
      speed <= IDLE_SPEED &&
      (s.ignitionOn === true || s.ignitionOn == null);

    if (s.fuelRateLph != null || s.engineRpm != null) obdHits += 1;
    if (s.gpsFixOk === true) gpsOk += 1;
    if (s.satellites != null) {
      satSum += Number(s.satellites);
      satN += 1;
    }
    if (s.externalVoltage != null) {
      const v = Number(s.externalVoltage);
      voltSum += v;
      voltN += 1;
      voltMin = voltMin == null ? v : Math.min(voltMin, v);
      if (v < LOW_VOLTAGE) lowVolt += 1;
    }
    if (s.backupBatteryLevel != null) {
      backupSum += Number(s.backupBatteryLevel);
      backupN += 1;
    }
    if (s.coolantC != null) {
      const c = Number(s.coolantC);
      coolantMax = coolantMax == null ? c : Math.max(coolantMax, c);
    }

    if (i === 0) continue;
    const prev = samples[i - 1];
    const dt = clampDtSeconds(
      s.recordedAt.getTime() - prev.recordedAt.getTime(),
    );
    const jump = haversineKm(
      Number(prev.latitude),
      Number(prev.longitude),
      Number(s.latitude),
      Number(s.longitude),
    );
    if (jump <= MAX_PATH_JUMP_KM) pathKm += jump;

    const ign =
      s.ignitionOn === true ||
      (s.ignitionOn == null && (moving || idle));
    if (ign) ignitionOnSeconds += dt;
    if (moving) {
      movingSeconds += dt;
      movingSamples += 1;
      speedSum += speed;
      speedN += 1;
      maxSpeed = maxSpeed == null ? speed : Math.max(maxSpeed, speed);
      if (s.overspeed === true) overspeedMoving += 1;
      if (s.fuelRateLph != null) {
        const rate = Number(s.fuelRateLph);
        litres += rate * (dt / 3600);
        litreSeconds += dt;
        fuelRateSum += rate;
        fuelRateN += 1;
      }
      if (s.engineRpm != null) {
        rpmSum += Number(s.engineRpm);
        rpmN += 1;
      }
      if (s.engineLoadPercent != null) {
        loadSum += Number(s.engineLoadPercent);
        loadN += 1;
      }
      movingObdStyle += 1;
      if (
        s.engineRpm != null &&
        Number(s.engineRpm) >= HIGH_RPM &&
        speed < LOW_SPEED_FOR_RPM
      ) {
        highRpmLowSpeed += 1;
      }
      if (prevWasIdle) stopCount += 1;
      prevWasIdle = false;
    } else if (idle) {
      idleSeconds += dt;
      if (s.fuelRateLph != null) {
        litres += Number(s.fuelRateLph) * (dt / 3600);
        litreSeconds += dt;
      }
      if (s.coolantC != null && Number(s.coolantC) >= COOLANT_HOT_C) {
        coolantHotSeconds += dt;
      }
      prevWasIdle = true;
    } else {
      prevWasIdle = false;
    }
    if (s.coolantC != null && Number(s.coolantC) >= COOLANT_HOT_C && moving) {
      coolantHotSeconds += dt;
    }
  }

  let distanceKm: number | null = null;
  let distanceBasis: DayRollupResult['distanceBasis'] = 'none';
  if (odoDelta != null && pathKm > 0) {
    const gap = Math.abs(odoDelta - pathKm) / Math.max(odoDelta, pathKm);
    if (gap < 0.25) {
      distanceKm = odoDelta;
      distanceBasis = 'odometer';
    } else {
      distanceKm = odoDelta;
      distanceBasis = 'mixed';
    }
  } else if (odoDelta != null) {
    distanceKm = odoDelta;
    distanceBasis = 'odometer';
  } else if (pathKm > 0) {
    distanceKm = pathKm;
    distanceBasis = 'path';
  }

  const ignHours = ignitionOnSeconds / 3600;
  const idlePct =
    ignitionOnSeconds > 0 ? (idleSeconds / ignitionOnSeconds) * 100 : null;
  const estimatedLitres = litreSeconds > 0 ? litres : null;
  const litresPer100km =
    estimatedLitres != null && distanceKm != null && distanceKm > 1
      ? (estimatedLitres / distanceKm) * 100
      : null;
  const kmPerLitre =
    estimatedLitres != null &&
    estimatedLitres > 0 &&
    distanceKm != null &&
    distanceKm > 0
      ? distanceKm / estimatedLitres
      : null;

  const fuelLevels = samples
    .map((s) => s.fuelLevelPercent)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const fuelLevelStart = fuelLevels.length ? fuelLevels[0] : null;
  const fuelLevelEnd = fuelLevels.length
    ? fuelLevels[fuelLevels.length - 1]
    : null;

  const obdCoveragePct = (obdHits / samples.length) * 100;
  let confidence: DayRollupResult['confidence'] = 'low';
  if (samples.length >= 20 && distanceKm != null && distanceKm > 1) {
    confidence =
      obdCoveragePct >= 40 || estimatedLitres == null ? 'high' : 'medium';
    if (estimatedLitres != null && obdCoveragePct < 40) confidence = 'medium';
    if (samples.length >= 20 && obdCoveragePct >= 60 && distanceBasis !== 'mixed')
      confidence = 'high';
  } else if (samples.length >= 5) {
    confidence = 'medium';
  }

  return {
    pointCount: samples.length,
    distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
    distanceBasis,
    movingSeconds: Math.round(movingSeconds),
    idleSeconds: Math.round(idleSeconds),
    ignitionOnSeconds: Math.round(ignitionOnSeconds),
    idlePct: idlePct != null ? Number(idlePct.toFixed(1)) : null,
    utilisationHours: Number(ignHours.toFixed(2)),
    avgSpeedMoving:
      speedN > 0 ? Number((speedSum / speedN).toFixed(1)) : null,
    maxSpeedKph: maxSpeed != null ? Number(maxSpeed.toFixed(1)) : null,
    stopCount,
    estimatedLitres:
      estimatedLitres != null ? Number(estimatedLitres.toFixed(3)) : null,
    litresPer100km:
      litresPer100km != null ? Number(litresPer100km.toFixed(2)) : null,
    kmPerLitre: kmPerLitre != null ? Number(kmPerLitre.toFixed(2)) : null,
    avgFuelRateMoving:
      fuelRateN > 0 ? Number((fuelRateSum / fuelRateN).toFixed(2)) : null,
    fuelLevelStart:
      fuelLevelStart != null ? Number(Number(fuelLevelStart).toFixed(1)) : null,
    fuelLevelEnd:
      fuelLevelEnd != null ? Number(Number(fuelLevelEnd).toFixed(1)) : null,
    avgRpmMoving: rpmN > 0 ? Number((rpmSum / rpmN).toFixed(0)) : null,
    avgLoadMoving: loadN > 0 ? Number((loadSum / loadN).toFixed(1)) : null,
    coolantMax: coolantMax != null ? Number(coolantMax.toFixed(1)) : null,
    coolantHotSeconds: Math.round(coolantHotSeconds),
    highRpmLowSpeedPct:
      movingObdStyle > 0
        ? Number(((highRpmLowSpeed / movingObdStyle) * 100).toFixed(1))
        : null,
    avgExternalVoltage:
      voltN > 0 ? Number((voltSum / voltN).toFixed(2)) : null,
    minExternalVoltage:
      voltMin != null ? Number(voltMin.toFixed(2)) : null,
    lowVoltagePct:
      voltN > 0 ? Number(((lowVolt / voltN) * 100).toFixed(1)) : null,
    avgBackupBattery:
      backupN > 0 ? Number((backupSum / backupN).toFixed(1)) : null,
    gpsFixOkPct: Number(((gpsOk / samples.length) * 100).toFixed(1)),
    avgSatellites: satN > 0 ? Number((satSum / satN).toFixed(1)) : null,
    overspeedSampleCount: overspeedMoving,
    overspeedMovingPct:
      movingSamples > 0
        ? Number(((overspeedMoving / movingSamples) * 100).toFixed(1))
        : null,
    obdCoveragePct: Number(obdCoveragePct.toFixed(1)),
    confidence,
  };
}

export type IncomeDayAgg = {
  incomeTotal: number;
  petrolLitres: number;
  petrolRand: number;
  distanceKm: number;
  entryCount: number;
};

export type ReconcileResult = {
  incomeTotal: number;
  incomePetrolLitres: number;
  incomePetrolRand: number;
  incomeDistanceKm: number;
  incomeEntryCount: number;
  trackerDistanceKm: number | null;
  trackerEstimatedLitres: number | null;
  distanceGapPct: number | null;
  fuelGapPct: number | null;
  randPerTrackerKm: number | null;
  incomePerKm: number | null;
  incomePerIgnitionHour: number | null;
  idleFuelWasteLitres: number | null;
  idleFuelWasteRand: number | null;
  flags: string[];
};

export function reconcileDay(
  rollup: Pick<
    DayRollupResult,
    | 'distanceKm'
    | 'estimatedLitres'
    | 'idleSeconds'
    | 'avgFuelRateMoving'
    | 'utilisationHours'
    | 'ignitionOnSeconds'
  >,
  income: IncomeDayAgg,
  opts?: { idleFuelRateLph?: number | null },
): ReconcileResult {
  const trackerDistanceKm = rollup.distanceKm;
  const trackerEstimatedLitres = rollup.estimatedLitres;
  const distanceGapPct =
    trackerDistanceKm != null &&
    trackerDistanceKm > 0 &&
    income.distanceKm > 0
      ? Number(
          (
            ((income.distanceKm - trackerDistanceKm) / trackerDistanceKm) *
            100
          ).toFixed(1),
        )
      : trackerDistanceKm != null &&
          trackerDistanceKm > 0 &&
          income.distanceKm === 0
        ? -100
        : null;
  const fuelGapPct =
    trackerEstimatedLitres != null &&
    trackerEstimatedLitres > 0 &&
    income.petrolLitres > 0
      ? Number(
          (
            ((income.petrolLitres - trackerEstimatedLitres) /
              trackerEstimatedLitres) *
            100
          ).toFixed(1),
        )
      : null;

  const incomePerKm =
    trackerDistanceKm != null && trackerDistanceKm > 0
      ? Number((income.incomeTotal / trackerDistanceKm).toFixed(2))
      : null;
  const randPerTrackerKm =
    trackerDistanceKm != null &&
    trackerDistanceKm > 0 &&
    income.petrolRand > 0
      ? Number((income.petrolRand / trackerDistanceKm).toFixed(2))
      : null;
  const ignHours = rollup.utilisationHours;
  const incomePerIgnitionHour =
    ignHours > 0
      ? Number((income.incomeTotal / ignHours).toFixed(2))
      : null;

  const idleHours = rollup.idleSeconds / 3600;
  const idleRate =
    opts?.idleFuelRateLph ??
    (rollup.avgFuelRateMoving != null
      ? rollup.avgFuelRateMoving * 0.35
      : null);
  const idleFuelWasteLitres =
    idleRate != null && idleHours > 0
      ? Number((idleRate * idleHours).toFixed(3))
      : null;
  const rPerL =
    income.petrolLitres > 0 ? income.petrolRand / income.petrolLitres : null;
  const idleFuelWasteRand =
    idleFuelWasteLitres != null && rPerL != null
      ? Number((idleFuelWasteLitres * rPerL).toFixed(2))
      : null;

  const flags: string[] = [];
  if (distanceGapPct != null && distanceGapPct < -25)
    flags.push('DISTANCE_UNDER');
  if (distanceGapPct != null && distanceGapPct > 25) flags.push('DISTANCE_OVER');
  if (fuelGapPct != null && fuelGapPct < -25) flags.push('FUEL_UNDER');
  if (fuelGapPct != null && fuelGapPct > 25) flags.push('FUEL_OVER');
  if (
    trackerDistanceKm != null &&
    trackerDistanceKm >= 40 &&
    income.incomeTotal > 0 &&
    incomePerKm != null &&
    incomePerKm < 5
  ) {
    flags.push('HIGH_KM_LOW_INCOME');
  }
  if (
    ignHours < 2 &&
    income.incomeTotal >= 800 &&
    (trackerDistanceKm == null || trackerDistanceKm < 15)
  ) {
    flags.push('LOW_UTILISATION_HIGH_INCOME');
  }

  return {
    incomeTotal: income.incomeTotal,
    incomePetrolLitres: income.petrolLitres,
    incomePetrolRand: income.petrolRand,
    incomeDistanceKm: income.distanceKm,
    incomeEntryCount: income.entryCount,
    trackerDistanceKm,
    trackerEstimatedLitres,
    distanceGapPct,
    fuelGapPct,
    randPerTrackerKm,
    incomePerKm,
    incomePerIgnitionHour,
    idleFuelWasteLitres,
    idleFuelWasteRand,
    flags,
  };
}

/** Africa/Johannesburg has no DST — fixed UTC+2. */
export function johannesburgDayBounds(day: string): { from: Date; to: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid day: ${day}`);
  }
  return {
    from: new Date(`${day}T00:00:00+02:00`),
    to: new Date(`${day}T23:59:59.999+02:00`),
  };
}

export function johannesburgToday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export function johannesburgYesterday(): string {
  const now = new Date();
  const asOf = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(asOf);
}
