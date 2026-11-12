-- What guests do besides answering: ad views and clicks, shares, opened links. One row
-- per action, counted by the admin dashboard. guest_id is empty when the visitor has no
-- session yet.
CREATE TABLE event (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guest_id      BIGINT      REFERENCES guest (id) ON DELETE CASCADE,
    type          VARCHAR(30) NOT NULL,
    category_code VARCHAR(50),
    created_at    TIMESTAMPTZ NOT NULL
);

-- the dashboard reads a date range, then groups by type
CREATE INDEX idx_event_created_at ON event (created_at);
