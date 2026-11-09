-- Per-tier coverage overrides were read but never editable: only the seed ever wrote them,
-- and they were lost on a new version or a plan copy. Coverage now comes from version_coverages only.
DROP TABLE IF EXISTS option_coverage_overrides;
