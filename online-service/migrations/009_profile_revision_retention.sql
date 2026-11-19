-- After pruning the snapshot, keep a receipt so a delayed retry cannot create another revision.
ALTER TABLE profile_revisions
    ALTER COLUMN request_json DROP NOT NULL,
    ADD COLUMN pruned_request_sha256 bytea,
    ADD CHECK ((request_json IS NULL) = (pruned_request_sha256 IS NOT NULL));

CREATE INDEX profile_revisions_with_snapshot ON profile_revisions(profile_id, revision)
    WHERE request_json IS NOT NULL;
