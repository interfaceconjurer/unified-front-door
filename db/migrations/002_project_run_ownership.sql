ALTER TABLE improvement_projects ADD UNIQUE (namespace_id, profile_id, id, run_id);
ALTER TABLE project_work_items DROP CONSTRAINT project_work_items_namespace_id_profile_id_project_id_fkey;
ALTER TABLE project_work_items ADD FOREIGN KEY (namespace_id, profile_id, project_id, run_id)
  REFERENCES improvement_projects(namespace_id, profile_id, id, run_id) ON DELETE CASCADE;
