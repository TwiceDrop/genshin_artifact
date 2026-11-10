CREATE TABLE profiles (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text,
    create_operation_id uuid NOT NULL,
    create_request jsonb,
    current_revision integer NOT NULL DEFAULT 0,
    last_revision integer NOT NULL DEFAULT 0,
    history_sequence integer NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    delete_operation_id uuid,
    delete_request jsonb,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    UNIQUE(user_id,create_operation_id)
);
CREATE INDEX profiles_user ON profiles(user_id,updated_at);
CREATE TABLE profile_revisions (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    base_revision integer NOT NULL,
    operation_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('applied','conflict')),
    device_id uuid NOT NULL,
    schema_version integer NOT NULL,
    app_version text NOT NULL,
    engine_version text NOT NULL,
    request_json jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY(profile_id,revision),
    UNIQUE(profile_id,operation_id)
);
CREATE TABLE profile_history (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sync_id uuid NOT NULL,
    sequence integer NOT NULL,
    summary jsonb NOT NULL,
    detail jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY(profile_id,sync_id),
    UNIQUE(profile_id,sequence)
);
