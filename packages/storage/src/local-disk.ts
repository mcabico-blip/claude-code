import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { PutOptions, StorageProvider, StoredObject } from './provider.js';

/**
 * LocalDisk driver: content under STORAGE_ROOT, sharded by id prefix, with a
 * JSON sidecar for metadata. Ids are opaque uuids — no caller ever sees a path.
 */
export class LocalDiskProvider implements StorageProvider {
  readonly driver = 'local';

  constructor(private readonly root: string) {}

  private paths(id: string): { blob: string; meta: string } {
    const safe = id.replace(/[^a-zA-Z0-9-]/g, '');
    const dir = join(resolve(this.root), safe.slice(0, 2));
    return { blob: join(dir, safe), meta: join(dir, `${safe}.json`) };
  }

  async put(data: Buffer, opts: PutOptions): Promise<StoredObject> {
    const id = randomUUID();
    const { blob, meta } = this.paths(id);
    const obj: StoredObject = {
      id,
      size: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
      contentType: opts.contentType,
      storedAt: new Date().toISOString(),
    };
    await mkdir(dirname(blob), { recursive: true });
    await writeFile(blob, data);
    await writeFile(meta, JSON.stringify(obj));
    return obj;
  }

  async stat(id: string): Promise<StoredObject | null> {
    try {
      const { meta } = this.paths(id);
      return JSON.parse(await readFile(meta, 'utf8')) as StoredObject;
    } catch {
      return null;
    }
  }

  async getStream(id: string): Promise<{ stream: ReturnType<typeof createReadStream>; meta: StoredObject }> {
    const meta = await this.stat(id);
    if (!meta) throw new Error(`object not found: ${id}`);
    const { blob } = this.paths(id);
    await stat(blob);
    return { stream: createReadStream(blob), meta };
  }

  async delete(id: string): Promise<void> {
    const { blob, meta } = this.paths(id);
    await rm(blob, { force: true });
    await rm(meta, { force: true });
  }
}
