import { AsyncLocalStorage } from 'async_hooks';

export interface TenantInfo {
  id: string;
  schemaName: string;
}

export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantInfo>();

  static run<T>(tenant: TenantInfo, fn: () => T): T {
    return this.storage.run(tenant, fn);
  }

  static get(): TenantInfo | undefined {
    return this.storage.getStore();
  }

  static getOrFail(): TenantInfo {
    const tenant = this.get();
    if (!tenant) {
      throw new Error('Tenant context is not set. Ensure the tenant middleware is applied.');
    }
    return tenant;
  }
}
