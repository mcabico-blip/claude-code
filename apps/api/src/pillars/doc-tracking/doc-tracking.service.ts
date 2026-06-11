import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserClaims, WhereIsAnswer } from '@ubi/types';
import { Repository } from 'typeorm';
import { DocumentMovementEntity } from './document-movement.entity';
import { DocumentEntity } from './document.entity';

@Injectable()
export class DocTrackingService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    @InjectRepository(DocumentMovementEntity) private readonly moves: Repository<DocumentMovementEntity>,
  ) {}

  private async nextCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.docs.count();
    return `DOC-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(
    user: UserClaims,
    input: { type: string; title: string; location?: string },
  ): Promise<DocumentEntity> {
    const doc = this.docs.create({
      code: await this.nextCode(),
      type: input.type,
      title: input.title,
      status: 'with-holder',
      currentHolder: user.name,
      currentLocation: input.location ?? 'origin',
      entity: user.entity,
      createdBy: user.email,
    });
    const saved = await this.docs.save(doc);
    await this.moves.save(
      this.moves.create({
        documentId: saved.id,
        from: '—',
        to: user.name,
        by: user.email,
        kind: 'create',
        note: 'labeled + registered',
        entity: user.entity,
        createdBy: user.email,
      }),
    );
    return saved;
  }

  async byCode(code: string): Promise<DocumentEntity> {
    const doc = await this.docs.findOne({ where: { code } });
    if (!doc) throw new NotFoundException(`no document ${code}`);
    return doc;
  }

  /** Scan to transmit: holder hands the paper to a destination. */
  async transmit(user: UserClaims, code: string, to: string, note?: string): Promise<DocumentEntity> {
    const doc = await this.byCode(code);
    await this.moves.save(
      this.moves.create({
        documentId: doc.id,
        from: doc.currentHolder,
        to,
        by: user.email,
        kind: 'transmit',
        note: note ?? null,
        entity: doc.entity,
        createdBy: user.email,
      }),
    );
    doc.status = 'in-transit';
    doc.currentHolder = to;
    return this.docs.save(doc);
  }

  /** Scan to receive: destination confirms the paper arrived. */
  async receive(user: UserClaims, code: string, location?: string): Promise<DocumentEntity> {
    const doc = await this.byCode(code);
    await this.moves.save(
      this.moves.create({
        documentId: doc.id,
        from: doc.currentHolder,
        to: user.name,
        by: user.email,
        kind: 'receive',
        note: location ? `received at ${location}` : null,
        entity: doc.entity,
        createdBy: user.email,
      }),
    );
    doc.status = 'received';
    doc.currentHolder = user.name;
    if (location) doc.currentLocation = location;
    return this.docs.save(doc);
  }

  /** The backbone question: where is this document right now? */
  async whereIs(code: string): Promise<WhereIsAnswer> {
    const doc = await this.byCode(code);
    const history = await this.moves.find({
      where: { documentId: doc.id },
      order: { createdAt: 'ASC' },
    });
    return {
      document: {
        id: doc.id,
        code: doc.code,
        entity: doc.entity,
        type: doc.type,
        title: doc.title,
        status: doc.status,
        currentHolder: doc.currentHolder,
        currentLocation: doc.currentLocation,
        createdAt: doc.createdAt.toISOString(),
      },
      history: history.map((m) => ({
        id: m.id,
        documentId: m.documentId,
        from: m.from,
        to: m.to,
        by: m.by,
        at: m.createdAt.toISOString(),
        kind: m.kind,
        note: m.note ?? undefined,
      })),
    };
  }

  async list(): Promise<DocumentEntity[]> {
    return this.docs.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
