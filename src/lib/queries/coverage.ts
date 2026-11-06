import { CoverageResolvedItem } from '@/types/insurance';
import { CoverageType, VersionCoverage } from '@/types/database';

export interface CoverageData {
  versionCoverages: VersionCoverage[];
  coverageTypes: CoverageType[];
}

// Every coverage type for a plan version, 'unknown' where the version doesn't set it.
export function resolveCoverages(planVersionId: string, data: CoverageData): CoverageResolvedItem[] {
  const versionCoverages = data.versionCoverages.filter((vc) => vc.plan_version_id === planVersionId);
  const coverageTypes = data.coverageTypes;

  return coverageTypes
    .map((type) => {
      const base = versionCoverages.find((vc) => vc.coverage_type_id === type.id);
      return {
        coverageTypeId: type.id,
        code: type.code,
        name: type.name,
        category: type.category,
        status: base?.status ?? 'unknown',
        limitAmount: base?.limit_amount,
        limitBasis: base?.limit_basis,
        deductibleAmount: base?.deductible_amount,
        terms: base?.terms,
        exclusions: base?.exclusions,
      };
    })
    .sort((a, b) => {
      const typeA = coverageTypes.find((t) => t.id === a.coverageTypeId)?.sort_order ?? 99;
      const typeB = coverageTypes.find((t) => t.id === b.coverageTypeId)?.sort_order ?? 99;
      return typeA - typeB;
    });
}
