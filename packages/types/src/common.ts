/** The two business entities. Every record in the suite is scoped to one. */
export type BusinessEntity = 'UBI' | 'OMEGA';

export const BUSINESS_ENTITIES: readonly BusinessEntity[] = ['UBI', 'OMEGA'];

/** Claim strings carried in the JWT, per the Identity pillar. */
export interface UserClaims {
  sub: string;
  email: string;
  name: string;
  entity: BusinessEntity;
  /** e.g. dept:engineering, role:manager, scope:project-<id>, role:ceo */
  claims: string[];
}

export type Severity = 'critical' | 'warning' | 'positive' | 'info';

export interface Paged<T> {
  items: T[];
  total: number;
}

/** Uniform report-submission status every module exposes (feeds ManCom + AI). */
export interface ReportStatus {
  module: string;
  report: string;
  due: string | null;
  submittedAt: string | null;
  status: 'on-time' | 'pending' | 'late' | 'received' | 'aggregate-only';
  detail?: string;
}
