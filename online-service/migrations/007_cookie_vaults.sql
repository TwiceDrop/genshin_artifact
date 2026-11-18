-- 米游社 Cookie 改为端到端加密（docs/specs/online-accounts/issues/04）：服务器只存客户端加密后的密文、盐和派生参数，
-- 不能解密，也不再定时拉取。旧的服务端托管、任务队列和角色快照一并删除（服务尚未部署，没有需要迁移的数据）。
DROP TABLE game_snapshots;
DROP TABLE sync_jobs;
DROP TABLE game_accounts;
CREATE TABLE cookie_vaults (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('miyoushe','hoyolab')),
    account_uid text NOT NULL,
    ciphertext text NOT NULL,
    salt text NOT NULL,
    kdf jsonb NOT NULL,
    format_version integer NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, platform, account_uid)
);
