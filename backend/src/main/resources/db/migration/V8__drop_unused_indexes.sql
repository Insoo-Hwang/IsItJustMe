-- The inactive guest cleanup and the overall result's full answer scan are gone.
DROP INDEX idx_guest_last_seen_at;
DROP INDEX idx_category_answer_category;
