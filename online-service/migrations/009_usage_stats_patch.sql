-- Usage stats: the content patch that was active when a feature was used. Empty when the install had no patch.
-- It is not part of the primary key: a feature used on one day is one row, and the patch recorded is the one
-- active when the row was first stored. The cumulative tables are not split by patch.
ALTER TABLE usage_stats_days ADD COLUMN patch text NOT NULL DEFAULT '';
