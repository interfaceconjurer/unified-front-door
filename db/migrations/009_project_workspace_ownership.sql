-- Brief-created projects have no assessment run, so the run foreign key alone
-- cannot enforce workspace ownership or cascade a profile reset. Remove only
-- orphaned projects whose owning workspace was already deleted.
DELETE FROM improvement_projects p
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.namespace_id = p.namespace_id AND w.profile_id = p.profile_id
);

ALTER TABLE improvement_projects ADD CONSTRAINT project_workspace_owner
  FOREIGN KEY (namespace_id, profile_id)
  REFERENCES workspaces(namespace_id, profile_id) ON DELETE CASCADE;
