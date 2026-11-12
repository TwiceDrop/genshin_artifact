-- Usage stats: anonymous install IDs only. No address, account or game data is stored here.
-- One row per install, feature, day, platform and version; rows older than 400 days are deleted.
CREATE TABLE usage_stats_days (
    install_id uuid NOT NULL,
    feature_id text NOT NULL,
    day date NOT NULL,
    platform text NOT NULL,
    version text NOT NULL,
    PRIMARY KEY (install_id, feature_id, day, platform, version)
);
CREATE INDEX usage_stats_days_day ON usage_stats_days(day);
-- The cumulative counts: one row per install, feature, platform and version, never deleted,
-- so totals survive the day-row cleanup and an install that used a feature in two versions
-- is still one install when the versions are added up.
CREATE TABLE usage_stats_firsts (
    install_id uuid NOT NULL,
    feature_id text NOT NULL,
    platform text NOT NULL,
    version text NOT NULL,
    first_day date NOT NULL,
    PRIMARY KEY (install_id, feature_id, platform, version)
);
