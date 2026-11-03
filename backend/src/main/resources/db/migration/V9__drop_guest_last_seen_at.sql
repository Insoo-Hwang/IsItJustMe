-- Nothing reads the last visit any more; the cookie is extended without it.
ALTER TABLE guest DROP COLUMN last_seen_at;
