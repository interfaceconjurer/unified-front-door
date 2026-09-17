ALTER TABLE workspaces ADD COLUMN epoch uuid NOT NULL DEFAULT gen_random_uuid();
