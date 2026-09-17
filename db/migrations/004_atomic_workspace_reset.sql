-- Runs and projects cascade together during a scoped reset. Check finding
-- references after all cascades, while retaining the constraint on normal writes.
ALTER TABLE project_work_items RENAME CONSTRAINT project_work_items_namespace_id_profile_id_run_id_finding__fkey TO work_item_finding;
ALTER TABLE project_work_items ALTER CONSTRAINT work_item_finding
  DEFERRABLE INITIALLY DEFERRED;
