CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE TABLE email_challenges (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    code_cipher text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE TABLE rate_limits (
    bucket text NOT NULL,
    window_start timestamptz NOT NULL,
    hits integer NOT NULL,
    PRIMARY KEY (bucket, window_start)
);
CREATE TABLE sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret_cipher text NOT NULL,
    device_name text NOT NULL,
    created_at timestamptz NOT NULL,
    last_used_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE game_accounts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('miyoushe','hoyolab')),
    account_uid text NOT NULL,
    credential_cipher text NOT NULL,
    revision integer NOT NULL DEFAULT 1,
    roles jsonb NOT NULL,
    status text NOT NULL DEFAULT 'ready',
    last_error text NOT NULL DEFAULT '',
    sync_enabled boolean NOT NULL DEFAULT true,
    interval_minutes integer NOT NULL CHECK (interval_minutes > 0),
    next_run_at timestamptz NOT NULL,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    UNIQUE (user_id, platform, account_uid)
);
CREATE INDEX game_accounts_due ON game_accounts(next_run_at) WHERE sync_enabled;
CREATE TABLE sync_jobs (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    status text NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL,
    lease_until timestamptz,
    lease_token uuid,
    created_at timestamptz NOT NULL,
    started_at timestamptz,
    finished_at timestamptz,
    error text NOT NULL DEFAULT '',
    error_code text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX one_active_job ON sync_jobs(account_id) WHERE status IN ('queued','running');
CREATE INDEX sync_jobs_due ON sync_jobs(available_at) WHERE status='queued';
CREATE TABLE game_snapshots (
    account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
    uid text NOT NULL,
    region text NOT NULL,
    updated_at timestamptz NOT NULL,
    snapshot jsonb NOT NULL,
    PRIMARY KEY (account_id,uid,region)
);
