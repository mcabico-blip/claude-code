import type { BusinessEntity } from './common.js';

/** Pillar 2 — Document Tracking. Every physical document gets an ID + QR. */
export type DocumentStatus = 'with-holder' | 'in-transit' | 'received' | 'archived';

export interface TrackedDocument {
  id: string;
  /** Human/QR code, e.g. DOC-2026-04187 */
  code: string;
  entity: BusinessEntity;
  type: string;
  title: string;
  status: DocumentStatus;
  currentHolder: string;
  currentLocation: string;
  createdAt: string;
}

export interface DocumentMovement {
  id: string;
  documentId: string;
  from: string;
  to: string;
  by: string;
  at: string;
  kind: 'transmit' | 'receive' | 'create';
  note?: string;
}

export interface WhereIsAnswer {
  document: TrackedDocument;
  history: DocumentMovement[];
}
