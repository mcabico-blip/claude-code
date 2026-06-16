import type { Readable } from 'node:stream';

export interface StoredObject {
  /** Opaque storage id — the ONLY thing Postgres ever stores (hard rule 3). */
  id: string;
  size: number;
  sha256: string;
  contentType: string;
  storedAt: string;
}

export interface PutOptions {
  contentType: string;
  /** Logical folder hint, e.g. "dr-photos" — drivers may ignore it. */
  bucket?: string;
}

/**
 * Swappable storage backend. LocalDisk today; Drive/S3/HCI later with no
 * caller rewrite. Files are ALWAYS served through the API with RBAC
 * (hard rule 4) — providers never expose public links or raw paths.
 */
export interface StorageProvider {
  readonly driver: string;
  put(data: Buffer, opts: PutOptions): Promise<StoredObject>;
  getStream(id: string): Promise<{ stream: Readable; meta: StoredObject }>;
  stat(id: string): Promise<StoredObject | null>;
  delete(id: string): Promise<void>;
}
