import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

type TenantStore = {
  tenantId: string | null;
};

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run(tenantId: string | null, callback: () => void): void {
    this.storage.run({ tenantId }, callback);
  }

  getTenantId(): string | null {
    return this.storage.getStore()?.tenantId ?? null;
  }
}



