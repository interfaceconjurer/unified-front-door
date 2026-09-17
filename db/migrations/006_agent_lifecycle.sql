ALTER TABLE workspaces ADD UNIQUE(namespace_id, profile_id, epoch);
ALTER TABLE demo_sessions ADD UNIQUE(namespace_id, id);
CREATE TABLE agent_conversations (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, epoch uuid NOT NULL,
  id uuid NOT NULL, thread_key text NOT NULL, revision integer NOT NULL DEFAULT 0,
  conversation jsonb NOT NULL, PRIMARY KEY(namespace_id, profile_id, id),
  UNIQUE(namespace_id, profile_id, epoch, thread_key),
  FOREIGN KEY(namespace_id, profile_id, epoch) REFERENCES workspaces(namespace_id, profile_id, epoch) ON DELETE CASCADE,
  CHECK(revision >= 0)
);
CREATE TABLE agent_runs (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, epoch uuid NOT NULL,
  id uuid NOT NULL, session_id uuid NOT NULL, generation uuid NOT NULL,
  request_id text NOT NULL, turn_id uuid, conversation_id uuid, retry_of uuid,
  kind text NOT NULL CHECK(kind IN ('chat','assessment')),
  status text NOT NULL CHECK(status IN ('pending','running','streaming','completed','failed','cancelled')),
  input jsonb NOT NULL, assessment_run_id text GENERATED ALWAYS AS (CASE WHEN kind='assessment' THEN input->>'assessmentRunId' END) STORED,
  checkpoint integer NOT NULL DEFAULT 0, result text, error jsonb,
  sequence integer NOT NULL DEFAULT 0, fence integer NOT NULL DEFAULT 0,
  recoveries integer NOT NULL DEFAULT 0, ready_at timestamptz NOT NULL DEFAULT clock_timestamp(), lease_until timestamptz,
  effect_id uuid, effect_tool text, effect_input jsonb, effect_state text NOT NULL DEFAULT 'none' CHECK(effect_state IN ('none','unknown','confirmed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(namespace_id, profile_id, id), UNIQUE(id),
  FOREIGN KEY(namespace_id, profile_id, epoch) REFERENCES workspaces(namespace_id, profile_id, epoch) ON DELETE CASCADE,
  FOREIGN KEY(namespace_id, session_id) REFERENCES demo_sessions(namespace_id, id) ON DELETE CASCADE,
  FOREIGN KEY(namespace_id, profile_id, assessment_run_id) REFERENCES assessment_runs(namespace_id, profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY(namespace_id, profile_id, conversation_id) REFERENCES agent_conversations(namespace_id, profile_id, id) ON DELETE CASCADE,
  FOREIGN KEY(namespace_id, profile_id, retry_of) REFERENCES agent_runs(namespace_id, profile_id, id),
  CHECK((kind='chat' AND conversation_id IS NOT NULL AND turn_id IS NOT NULL) OR (kind='assessment' AND conversation_id IS NULL AND turn_id IS NULL)),
  CHECK(jsonb_typeof(input)='object' AND (input->>'kind') IS NOT DISTINCT FROM kind AND (kind='chat' OR assessment_run_id IS NOT NULL)),
  CHECK((effect_state='none' AND effect_id IS NULL AND effect_tool IS NULL AND effect_input IS NULL) OR (effect_state<>'none' AND effect_id IS NOT NULL AND effect_tool IS NOT NULL AND effect_input IS NOT NULL)),
  CHECK(checkpoint >= 0 AND sequence >= 0 AND fence >= 0 AND recoveries >= 0)
);
CREATE UNIQUE INDEX agent_one_assessment ON agent_runs(namespace_id,profile_id,epoch) WHERE kind='assessment' AND status IN ('pending','running','streaming');
CREATE UNIQUE INDEX agent_one_chat ON agent_runs(namespace_id,profile_id,conversation_id) WHERE kind='chat' AND status IN ('pending','running','streaming');
CREATE INDEX agent_ready ON agent_runs(ready_at,created_at) WHERE status IN ('pending','running','streaming');
CREATE TABLE agent_events (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, run_id uuid NOT NULL, sequence integer NOT NULL,
  event jsonb NOT NULL, PRIMARY KEY(namespace_id,profile_id,run_id,sequence),
  FOREIGN KEY(namespace_id,profile_id,run_id) REFERENCES agent_runs(namespace_id,profile_id,id) ON DELETE CASCADE,
  CHECK(sequence > 0)
);
CREATE TABLE agent_receipts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, generation uuid NOT NULL, request_id text NOT NULL,
  payload_hash text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(namespace_id,profile_id,generation,request_id),
  FOREIGN KEY(namespace_id,profile_id) REFERENCES workspaces(namespace_id,profile_id) ON DELETE CASCADE
);
