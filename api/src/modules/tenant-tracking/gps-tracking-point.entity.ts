import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'gps_tracking_points' })
export class GpsTrackingPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column({ name: 'vehicle_label', type: 'varchar', nullable: true })
  vehicleLabel: string | null;

  @Column({ name: 'device_id', type: 'varchar', nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', nullable: true, default: 'dashcam' })
  source: string | null;

  @Column({ type: 'numeric' })
  latitude: number;

  @Column({ type: 'numeric' })
  longitude: number;

  @Column({ name: 'speed_kph', type: 'numeric', nullable: true })
  speedKph: number | null;

  @Column({ type: 'numeric', nullable: true })
  heading: number | null;

  @Column({ name: 'ignition_on', type: 'boolean', nullable: true })
  ignitionOn: boolean | null;

  @Column({ name: 'external_voltage', type: 'numeric', nullable: true })
  externalVoltage: number | null;

  @Column({ name: 'backup_battery_level', type: 'smallint', nullable: true })
  backupBatteryLevel: number | null;

  @Column({ name: 'gps_fix_ok', type: 'boolean', nullable: true })
  gpsFixOk: boolean | null;

  @Column({ type: 'smallint', nullable: true })
  satellites: number | null;

  @Column({ name: 'engine_rpm', type: 'numeric', nullable: true })
  engineRpm: number | null;

  @Column({ name: 'fuel_rate_lph', type: 'numeric', nullable: true })
  fuelRateLph: number | null;

  @Column({ name: 'fuel_level_percent', type: 'numeric', nullable: true })
  fuelLevelPercent: number | null;

  @Column({ name: 'odometer_km', type: 'numeric', nullable: true })
  odometerKm: number | null;

  @Column({ name: 'coolant_c', type: 'numeric', nullable: true })
  coolantC: number | null;

  @Column({ name: 'engine_load_percent', type: 'numeric', nullable: true })
  engineLoadPercent: number | null;

  @Column({ type: 'boolean', nullable: true })
  overspeed: boolean | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'raw_payload', type: 'text', nullable: true })
  rawPayload: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
