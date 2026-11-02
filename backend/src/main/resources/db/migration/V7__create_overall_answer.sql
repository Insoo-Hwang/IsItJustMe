-- Every category answer of a guest in one number, kept only once the guest answered all
-- of them. Category n (by sort_order, from 0) takes bits n*10 to n*10+9.
CREATE TABLE overall_answer (
    guest_id     BIGINT PRIMARY KEY REFERENCES guest (id) ON DELETE CASCADE,
    overall_bits BIGINT NOT NULL
);

INSERT INTO overall_answer (guest_id, overall_bits)
SELECT a.guest_id, BIT_OR(a.answer_bits::BIGINT << (c.position * 10))
FROM category_answer a
JOIN (SELECT id, (ROW_NUMBER() OVER (ORDER BY sort_order) - 1)::INT AS position FROM category) c
  ON c.id = a.category_id
GROUP BY a.guest_id
HAVING COUNT(*) = (SELECT COUNT(*) FROM category);
