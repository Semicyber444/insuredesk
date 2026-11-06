import { CoverageResolvedItem } from '@/types/insurance';
import { CoverageType, OptionCoverageOverride, VersionCoverage } from '@/types/database';

export interface CoverageData {
  versionCoverages: VersionCoverage[];
  overrides: OptionCoverageOverride[];
  coverageTypes: CoverageType[];
}

// Helper to resolve coverages for a given price_option and plan_version
export function resolveCoverages(
  planVersionId: string,
  priceOptionId: string,
  data: CoverageData
): CoverageResolvedItem[] {
  const versionCoverages = data.versionCoverages.filter((vc) => vc.plan_version_id === planVersionId);
  const overrides = data.overrides.filter((o) => o.price_option_id === priceOptionId);
  const coverageTypes = data.coverageTypes;

  return coverageTypes
    .map((type) => {
      const override = overrides.find((o) => o.coverage_type_id === type.id);
      if (override) {
        return {
          coverageTypeId: type.id,
          code: type.code,
          name: type.name,
          category: type.category,
          status: override.status,
          limitAmount: override.limit_amount,
          limitBasis: override.limit_basis,
          deductibleAmount: override.deductible_amount,
          terms: override.terms,
          exclusions: override.exclusions,
          isOverridden: true,
        };
      }

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
        isOverridden: false,
      };
    })
    .sort((a, b) => {
      const typeA = coverageTypes.find((t) => t.id === a.coverageTypeId)?.sort_order ?? 99;
      const typeB = coverageTypes.find((t) => t.id === b.coverageTypeId)?.sort_order ?? 99;
      return typeA - typeB;
    });
}
