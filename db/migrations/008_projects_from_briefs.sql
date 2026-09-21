-- Projects created from briefs have no assessment source. Assessment-backed
-- projects retain their existing run foreign key and work-item ownership.
ALTER TABLE improvement_projects ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE improvement_projects ADD CONSTRAINT project_source_matches_run
  CHECK ((run_id IS NULL AND COALESCE(record->>'source', 'assessment') = 'brief')
    OR (run_id IS NOT NULL AND COALESCE(record->>'source', 'assessment') = 'assessment'));
