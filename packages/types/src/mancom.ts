import type { ReportStatus, Severity } from './common.js';

/** CEO / ManCom consolidated snapshot — the suite's primary output. */
export interface ManComKpis {
  activeProjects: number;
  flaggedProjects: number;
  billingsMonthCentavos: number;
  billingsDeltaPct: number;
  billingDraftsSubmitted: number;
  billingDraftsTotal: number;
  avgSlippagePct: number;
  projectedSlippagePct: number | null;
  openExceptions: number;
  escalatedExceptions: number;
  /** Overall in-house accomplishment (0..1) from Quantity weekly rollup. */
  accomplishmentPct: number;
  /** ₱ accomplished this month across all projects (Quantity rollup). */
  accomplishmentMonth: number;
}

export interface TrendPoint {
  period: string;
  plan: number | null;
  actual: number | null;
  projected: number | null;
}

export interface FlaggedProject {
  projectCode: string;
  projectName: string;
  pe: string;
  pm: string;
  slippagePct: number;
  projectedPct: number | null;
  trend: number[];
}

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  /** Grounding — read-model references, e.g. "procurement.dr-log wk22-24" */
  evidence: string[];
  actions: string[];
  generatedAt: string;
  generatedBy: string;
}

export interface QuantityTop {
  code: string;
  name: string;
  pe: string;
  pct: number;
  thisMonth: number;
}

export interface ManComSnapshot {
  asOf: string;
  kpis: ManComKpis;
  accomplishment: TrendPoint[];
  surveyVolumes: TrendPoint[];
  flagged: FlaggedProject[];
  reportFeed: ReportStatus[];
  topInsights: Insight[];
  /** Top projects by this-month accomplishment (Quantity rollup → CEO). */
  quantityTop: QuantityTop[];
}

/** Pillar 3 — descriptor for a module's AI-queryable read model. */
export interface ReadModelDescriptor {
  key: string;
  module: string;
  title: string;
  description: string;
  /** RBAC claim required to query, if any beyond login. */
  requiresClaim?: string;
}

export interface AskAnswer {
  question: string;
  answer: string;
  sources: string[];
  answeredAt: string;
}
