CREATE TABLE demo_namespaces (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE demo_sessions (
  id uuid PRIMARY KEY, namespace_id uuid NOT NULL REFERENCES demo_namespaces(id),
  token_hash text NOT NULL UNIQUE, profile_id text CHECK (profile_id IN ('jw','kf','am','sp')),
  generation uuid NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX demo_sessions_namespace ON demo_sessions(namespace_id);
CREATE TABLE workspaces (
  namespace_id uuid NOT NULL REFERENCES demo_namespaces(id),
  profile_id text NOT NULL CHECK (profile_id IN ('jw','kf','am','sp')),
  assessment_revision integer NOT NULL DEFAULT 0 CHECK (assessment_revision >= 0), assessment_cursor jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id)
);
CREATE TABLE assessment_runs (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, id text NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id, id),
  FOREIGN KEY (namespace_id, profile_id) REFERENCES workspaces(namespace_id, profile_id) ON DELETE CASCADE
);
CREATE TABLE assessment_findings (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, run_id text NOT NULL, id text NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id, run_id, id),
  FOREIGN KEY (namespace_id, profile_id, run_id) REFERENCES assessment_runs(namespace_id, profile_id, id) ON DELETE CASCADE
);
CREATE TABLE project_drafts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, id text NOT NULL, run_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), record jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id), UNIQUE (namespace_id, profile_id, id),
  FOREIGN KEY (namespace_id, profile_id, run_id) REFERENCES assessment_runs(namespace_id, profile_id, id) ON DELETE CASCADE
);
CREATE TABLE improvement_projects (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, id text NOT NULL, run_id text NOT NULL,
  source_draft_id text NOT NULL, create_command_id text NOT NULL, revision integer NOT NULL CHECK (revision > 0), record jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id, id), UNIQUE (namespace_id, profile_id, source_draft_id), UNIQUE (namespace_id, profile_id, create_command_id),
  FOREIGN KEY (namespace_id, profile_id, run_id) REFERENCES assessment_runs(namespace_id, profile_id, id) ON DELETE CASCADE
);
CREATE TABLE project_work_items (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, project_id text NOT NULL, id text NOT NULL, run_id text NOT NULL,
  finding_id text NOT NULL, status text NOT NULL CHECK (status IN ('todo','in-progress','done')), record jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id, project_id, id), UNIQUE (namespace_id, profile_id, run_id, finding_id),
  FOREIGN KEY (namespace_id, profile_id, project_id) REFERENCES improvement_projects(namespace_id, profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY (namespace_id, profile_id, run_id, finding_id) REFERENCES assessment_findings(namespace_id, profile_id, run_id, id)
);
CREATE TABLE canvas_drafts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, id text NOT NULL,
  surface_id text NOT NULL CHECK (surface_id IN ('code','build','govern','alm')), canvas jsonb NOT NULL, target jsonb NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL CHECK (revision > 0), provenance jsonb,
  PRIMARY KEY (namespace_id, profile_id, id),
  FOREIGN KEY (namespace_id, profile_id) REFERENCES workspaces(namespace_id, profile_id) ON DELETE CASCADE
);
CREATE TABLE command_receipts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, generation uuid NOT NULL, command_id text NOT NULL,
  payload_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace_id, profile_id, generation, command_id),
  FOREIGN KEY (namespace_id, profile_id) REFERENCES workspaces(namespace_id, profile_id) ON DELETE CASCADE
);
CREATE TABLE import_receipts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, source_hash text NOT NULL, summary jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace_id, profile_id, source_hash),
  FOREIGN KEY (namespace_id, profile_id) REFERENCES workspaces(namespace_id, profile_id) ON DELETE CASCADE
);
CREATE TABLE session_receipts (
  session_id uuid NOT NULL REFERENCES demo_sessions(id), command_id text NOT NULL, payload_hash text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (session_id, command_id)
);
