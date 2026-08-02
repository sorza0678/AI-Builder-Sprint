import type { ApiRiskLevel } from '@/src/services/api-types';
import type { RiskLevel } from '@/src/types/marketplace';

export const riskMap: Record<ApiRiskLevel, RiskLevel> = { SAFE: 'LOW', WARNING: 'MEDIUM', DANGER: 'HIGH' };
