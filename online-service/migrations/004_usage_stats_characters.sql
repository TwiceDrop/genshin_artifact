-- Usage stats by character: which characters single optimisation and team DPS ran for.
-- Same shape as the feature tables: day rows (deleted after 400 days) and cumulative first-use rows.
CREATE TABLE usage_stats_character_days (
    install_id uuid NOT NULL,
    character text NOT NULL,
    feature_id text NOT NULL,
    day date NOT NULL,
    platform text NOT NULL,
    version text NOT NULL,
    PRIMARY KEY (install_id, character, feature_id, day, platform, version)
);
CREATE INDEX usage_stats_character_days_day ON usage_stats_character_days(day);
CREATE TABLE usage_stats_character_firsts (
    install_id uuid NOT NULL,
    character text NOT NULL,
    feature_id text NOT NULL,
    platform text NOT NULL,
    version text NOT NULL,
    first_day date NOT NULL,
    PRIMARY KEY (install_id, character, feature_id, platform, version)
);
