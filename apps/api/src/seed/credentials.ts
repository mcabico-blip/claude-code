// Managed account password hashes (bcrypt — one-way, safe to commit).
// Plaintexts are NOT stored here. Pilot password for ALL accounts is shared
// (set/known via chat). ensureUser force-applies these on boot; rotate by
// regenerating this map.
const ALL = '$2a$10$iyM9J8mhDIzDJSc64pqH9uNlVdJCfMIyLexx0B3/dkUroX9o0RJEO';

export const CREDENTIAL_HASHES: Record<string, string> = {
  'admin@ubi.ph': ALL,
  'ceo@ubi.ph': ALL,
  'vpo@ubi.ph': ALL,
  'pm@ubi.ph': ALL,
  'pe@ubi.ph': ALL,
  'insights-agent@ubi.ph': ALL,
  'head-engineering@ubi.ph': ALL,
  'head-procurement@ubi.ph': ALL,
  'head-operations@ubi.ph': ALL,
  'head-survey@ubi.ph': ALL,
  'head-mqc@ubi.ph': ALL,
  'head-audit@ubi.ph': ALL,
  'head-it@ubi.ph': ALL,
  'head-records@ubi.ph': ALL,
  'head-clinic@ubi.ph': ALL,
  'head-admin@ubi.ph': ALL,
  'head-hr@ubi.ph': ALL,
  'head-property@ubi.ph': ALL,
  'head-finance@ubi.ph': ALL,
};
