import type { BusinessEntity } from './common.js';

/** Canonical DPWH material catalog (from the Monthly Projection sheet). */
export interface MaterialDef {
  name: string;
  unit: string;
  group: string;
}

export const MATERIALS_CATALOG: readonly MaterialDef[] = [
  { name: 'Cement Bulk', unit: 'bulk', group: 'Cement' },
  { name: 'Cement Tonner', unit: 'tonner bags', group: 'Cement' },
  { name: 'Cement 40kg', unit: '40kg', group: 'Cement' },
  { name: 'Ready Mix Concrete 4000 PSI', unit: 'cu.m', group: 'Concrete' },
  { name: 'Steel sheet Pile (pc)', unit: 'pcs', group: 'Steel piles' },
  { name: 'Steel sheet Pile (lm)', unit: 'lm', group: 'Steel piles' },
  { name: 'Washed Sand', unit: 'cu.m', group: 'Aggregates' },
  { name: 'Coarse Sand', unit: 'cu.m', group: 'Aggregates' },
  { name: 'Gravel 3/4', unit: 'cu.m', group: 'Aggregates' },
  { name: 'Gravel G1', unit: 'cu.m', group: 'Aggregates' },
  { name: 'Item 200', unit: 'cu.m', group: 'Roadway' },
  { name: 'Item 300', unit: 'cu.m', group: 'Roadway' },
  { name: 'Boulders', unit: 'cu.m', group: 'Aggregates' },
  { name: 'Borrow Materials', unit: 'cu.m', group: 'Earthworks' },
  { name: 'Mountain Mix/Earthfill', unit: 'cu.m', group: 'Earthworks' },
  { name: 'Reinforcing Steel 12mmØ x 12 m', unit: 'pcs', group: 'Rebar' },
  { name: 'Reinforcing Steel 16mmØ x 12 m', unit: 'pcs', group: 'Rebar' },
  { name: 'Reinforcing Steel 20mmØ x 12 m', unit: 'pcs', group: 'Rebar' },
  { name: 'Reinforcing Steel 25mmØ x 12 m', unit: 'pcs', group: 'Rebar' },
  { name: 'Reinforcing Steel Bar G40 (kg)', unit: 'kg', group: 'Rebar' },
];

/** Weekly accomplishment entry by a Quantity Engineer onsite — the one number
 *  they add each week; weeks auto-roll into the monthly cost-accomplishment report. */
export interface QuantityEntry {
  id: string;
  projectId: string;
  weekOf: string;
  amount: number; // ₱ accomplished this week (in-house basis)
  enteredBy: string;
  note?: string;
}

/** Per-project accomplishment rollup (feeds Quantity head dash + ManCom). */
export interface QuantityRollup {
  projectId: string;
  code: string;
  name: string;
  pe: string;
  inhouseAmount: number;
  priorAccomplished: number;
  toDate: number;
  pct: number;
  thisMonth: number;
  lastWeekOf: string | null;
  entity: BusinessEntity;
}

/** Monthly projection: projected ₱ accomplishment + material requirements. */
export interface MonthProjection {
  projectId: string;
  month: string; // YYYY-MM
  projectedAmount: number;
}

export interface MaterialReq {
  projectId: string;
  month: string;
  material: string;
  unit: string;
  qty: number;
}
