import { LocalDiskProvider } from './local-disk.js';
import type { StorageProvider } from './provider.js';

export * from './provider.js';
export * from './local-disk.js';

export interface StorageConfig {
  driver: string;
  root?: string;
}

/** Driver switch lives here — adding drive/s3/hci later touches only this file. */
export function createStorageProvider(cfg: StorageConfig): StorageProvider {
  switch (cfg.driver) {
    case 'local':
      return new LocalDiskProvider(cfg.root ?? './uploads');
    default:
      throw new Error(`unknown storage driver: ${cfg.driver}`);
  }
}
