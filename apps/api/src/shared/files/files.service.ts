import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { StorageProvider } from '@ubi/storage';
import type { UserClaims } from '@ubi/types';
import type { Readable } from 'node:stream';
import { Repository } from 'typeorm';
import { hasClaim } from '../../common/rbac';
import { FileEntity } from './file.entity';
import { STORAGE } from './storage.token';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity) private readonly files: Repository<FileEntity>,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}

  async store(
    user: UserClaims,
    input: { buffer: Buffer; filename: string; contentType: string; context: string; requiresClaim?: string },
  ): Promise<FileEntity> {
    const stored = await this.storage.put(input.buffer, { contentType: input.contentType });
    const row = this.files.create({
      storageId: stored.id,
      filename: input.filename,
      contentType: input.contentType,
      size: stored.size,
      sha256: stored.sha256,
      context: input.context,
      requiresClaim: input.requiresClaim ?? null,
      entity: user.entity,
      createdBy: user.email,
    });
    return this.files.save(row);
  }

  /** Files are served through here with RBAC — never via raw paths (rule 4). */
  async open(user: UserClaims, id: string): Promise<{ meta: FileEntity; stream: Readable }> {
    const meta = await this.files.findOne({ where: { id } });
    if (!meta) throw new NotFoundException('no such file');
    if (meta.requiresClaim && !hasClaim(user, meta.requiresClaim)) {
      throw new ForbiddenException(`file requires ${meta.requiresClaim}`);
    }
    const { stream } = await this.storage.getStream(meta.storageId);
    return { meta, stream };
  }
}
