-- Each category drops one question, moves the ones after it up by one, and gets a new
-- question 10. Texts come from STORY.md on startup; this keeps the stored answers in line:
-- every later answer moves down one bit, and the new question 10 is filled with option 0
-- (A) for guests who answered before it existed.
CREATE TEMPORARY TABLE removed_question (category_code VARCHAR(50) PRIMARY KEY, bit_position INT NOT NULL)
    ON COMMIT DROP;
INSERT INTO removed_question VALUES
    ('food', 8),
    ('love', 4),
    ('life', 7),
    ('travel', 5),
    ('spending', 8),
    ('people', 8);

-- Holds off answer writes so none lands between the remap and the recounts below.
LOCK TABLE category_answer, combination_stats, overall_answer IN SHARE ROW EXCLUSIVE MODE;

-- bits below the removed one stay, bits above it move down one, bit 9 becomes 0
UPDATE category_answer a
SET answer_bits = ((a.answer_bits & ((1 << r.bit_position) - 1))
                   | ((a.answer_bits >> (r.bit_position + 1)) << r.bit_position))::SMALLINT
FROM category c
JOIN removed_question r ON r.category_code = c.code
WHERE c.id = a.category_id;

-- Question codes follow their question: the moved ones keep theirs, the removed code goes
-- away and the new question 10 gets the next number. Codes are unique, so they pass
-- through a placeholder first.
UPDATE question q
SET code = '~' || q.code
FROM category c
JOIN removed_question r ON r.category_code = c.code
WHERE c.id = q.category_id AND q.bit_position >= r.bit_position;

UPDATE question q
SET code = CASE
        WHEN q.bit_position = 9 THEN c.code || '-11'
        ELSE c.code || '-' || LPAD((q.bit_position + 2)::TEXT, 2, '0')
    END
FROM category c
JOIN removed_question r ON r.category_code = c.code
WHERE c.id = q.category_id AND q.bit_position >= r.bit_position;

-- recount everything that is built from the answers
DELETE FROM combination_stats;
INSERT INTO combination_stats (category_id, gender, age_group, answer_bits, participant_count)
SELECT category_id, gender, age_group, answer_bits, COUNT(*)
FROM category_answer
GROUP BY category_id, gender, age_group, answer_bits;

UPDATE overall_answer o
SET overall_bits = s.overall_bits
FROM (
    SELECT a.guest_id, BIT_OR(a.answer_bits::BIGINT << (c.position * 10)) AS overall_bits
    FROM category_answer a
    JOIN (SELECT id, (ROW_NUMBER() OVER (ORDER BY sort_order) - 1)::INT AS position FROM category) c
      ON c.id = a.category_id
    GROUP BY a.guest_id
) s
WHERE s.guest_id = o.guest_id;

SELECT overall_stats_rebuild();
