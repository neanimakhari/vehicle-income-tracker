import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const createTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const sslEnabled = configService.get<boolean>('db.ssl');

  return {
    type: 'postgres',
    host: configService.get<string>('db.host'),
    port: configService.get<number>('db.port'),
    username: configService.get<string>('db.username'),
    password: configService.get<string>('db.password'),
    database: configService.get<string>('db.database'),
    schema: configService.get<string>('db.defaultSchema'),
    autoLoadEntities: true,
    synchronize: false,
    logging: configService.get<string>('app.env') !== 'production',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  };
};



