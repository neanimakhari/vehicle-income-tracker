import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { TenantScopeService } from './tenant-scope.service';

export class TenantAwareRepository<T extends ObjectLiteral> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly entity: EntityTarget<T>,
  ) {}

  async withSchema<R>(handler: (repo: Repository<T>) => Promise<R>): Promise<R> {
    const schema = this.tenantScope.getTenantSchema();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query(`SET search_path TO "${schema}"`);
      const repo = queryRunner.manager.getRepository<T>(this.entity);
      const metadata = repo.metadata as typeof repo.metadata & { tablePath?: string };
      const originalSchema = metadata.schema;
      const originalTablePath = metadata.tablePath;
      const driver = queryRunner.connection.driver;
      metadata.schema = schema;
      metadata.tablePath = driver.buildTableName(metadata.tableName, schema, metadata.database);
      try {
        return await handler(repo);
      } finally {
        metadata.schema = originalSchema;
        metadata.tablePath = originalTablePath;
      }
    } finally {
      await queryRunner.release();
    }
  }
}


