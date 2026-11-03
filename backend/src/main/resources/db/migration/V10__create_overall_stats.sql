-- How many guests answered every category, and how many of them picked option 1 at each
-- bit of overall_bits. One row, so a read always gets the count and the 60 numbers from
-- the same moment, and a write never waits on more than one row lock.
CREATE TABLE overall_stats (
    id           SMALLINT PRIMARY KEY DEFAULT 1,
    participants BIGINT   NOT NULL,
    one_counts   BIGINT[] NOT NULL,
    CONSTRAINT chk_overall_stats_single CHECK (id = 1),
    CONSTRAINT chk_overall_stats_participants CHECK (participants >= 0),
    CONSTRAINT chk_overall_stats_bits CHECK (cardinality(one_counts) = 60)
);

-- Counts everything again from overall_answer. Run once below, and by hand if the row
-- ever needs repairing.
CREATE FUNCTION overall_stats_rebuild() RETURNS void LANGUAGE sql AS $$
    INSERT INTO overall_stats (id, participants, one_counts)
    SELECT 1,
           (SELECT COUNT(*) FROM overall_answer),
           ARRAY(SELECT COUNT(o.guest_id) FILTER (WHERE (o.overall_bits >> b) & 1 = 1)
                 FROM generate_series(0, 59) AS b
                 LEFT JOIN overall_answer o ON true
                 GROUP BY b
                 ORDER BY b)
    ON CONFLICT (id) DO UPDATE SET participants = EXCLUDED.participants, one_counts = EXCLUDED.one_counts;
$$;

-- Moves one guest's answers out of and into the counts. A trigger rather than the
-- service, so a guest deleted with ON DELETE CASCADE is counted out too.
CREATE FUNCTION overall_stats_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    old_bits BIGINT := CASE WHEN TG_OP <> 'INSERT' THEN OLD.overall_bits END;
    new_bits BIGINT := CASE WHEN TG_OP <> 'DELETE' THEN NEW.overall_bits END;
BEGIN
    UPDATE overall_stats
    SET participants = participants + (new_bits IS NOT NULL)::INT - (old_bits IS NOT NULL)::INT,
        one_counts = ARRAY(
            SELECT c + COALESCE((new_bits >> (i - 1)::INT) & 1, 0) - COALESCE((old_bits >> (i - 1)::INT) & 1, 0)
            FROM unnest(one_counts) WITH ORDINALITY AS t (c, i)
            ORDER BY i)
    WHERE id = 1;
    RETURN NULL;
END;
$$;

-- Holds off answer writes until this migration commits, so none is counted twice or missed
-- between the count below and the triggers taking over.
LOCK TABLE overall_answer IN SHARE ROW EXCLUSIVE MODE;

CREATE TRIGGER trg_overall_stats_insert_delete
    AFTER INSERT OR DELETE ON overall_answer
    FOR EACH ROW EXECUTE FUNCTION overall_stats_apply();

CREATE TRIGGER trg_overall_stats_update
    AFTER UPDATE OF overall_bits ON overall_answer
    FOR EACH ROW WHEN (OLD.overall_bits IS DISTINCT FROM NEW.overall_bits)
    EXECUTE FUNCTION overall_stats_apply();

SELECT overall_stats_rebuild();
