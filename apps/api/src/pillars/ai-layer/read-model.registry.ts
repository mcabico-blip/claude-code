import { Injectable } from '@nestjs/common';
import type { ReadModelDescriptor, UserClaims } from '@ubi/types';

export type ReadModelHandler = (user: UserClaims) => Promise<unknown> | unknown;

/**
 * Pillar 3 — every module registers a consistent, RBAC-aware read surface
 * here. Off-box agents, the CEO chat, and ManCom consolidation are all
 * clients of this registry; nothing queries module tables directly.
 */
@Injectable()
export class ReadModelRegistry {
  private readonly models = new Map<string, { descriptor: ReadModelDescriptor; handler: ReadModelHandler }>();

  register(descriptor: ReadModelDescriptor, handler: ReadModelHandler): void {
    this.models.set(descriptor.key, { descriptor, handler });
  }

  list(): ReadModelDescriptor[] {
    return [...this.models.values()].map((m) => m.descriptor);
  }

  get(key: string): { descriptor: ReadModelDescriptor; handler: ReadModelHandler } | undefined {
    return this.models.get(key);
  }
}
