import type { BusinessEntity } from './common.js';

/** Master DPWH Blue Book pay-item library — shared reference suite-wide. */
export interface PayItem {
  id: string;
  /** e.g. "311(1)c" */
  itemNo: string;
  description: string;
  unit: string;
}

export interface Project {
  id: string;
  entity: BusinessEntity;
  code: string;
  name: string;
  /** DPWH contract id */
  contractNo: string;
  status: 'bidding' | 'ntp' | 'active' | 'completed';
  slippagePct: number;
}

export type ApprovalStep = 'pe' | 'pm' | 'vpo';
export type ScheduleStatus = 'draft' | 'submitted' | 'pm-approved' | 'vpo-approved' | 'returned';

/** Weekly materials schedule line (AI pre-filled, PE adjusts). */
export interface MaterialsScheduleLine {
  payItemNo: string;
  material: string;
  quantity: number;
  unit: string;
  aiSuggested: boolean;
}

export interface MaterialsSchedule {
  id: string;
  entity: BusinessEntity;
  projectId: string;
  weekOf: string;
  lines: MaterialsScheduleLine[];
  status: ScheduleStatus;
  preparedBy: string;
}
