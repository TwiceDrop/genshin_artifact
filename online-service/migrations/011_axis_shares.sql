CREATE TABLE axis_shares (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    axis jsonb NOT NULL,
    version integer NOT NULL DEFAULT 1,
    published_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    UNIQUE (owner_id, request_id)
);
CREATE INDEX axis_shares_owner ON axis_shares(owner_id, published_at DESC);
