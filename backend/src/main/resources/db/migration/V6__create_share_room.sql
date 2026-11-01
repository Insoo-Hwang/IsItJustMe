-- One share room per owner. The link carries only share_token; the owner's name is
-- typed when sharing and shown on the invite page.
CREATE TABLE share_room (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_guest_id BIGINT      NOT NULL UNIQUE REFERENCES guest (id) ON DELETE CASCADE,
    share_token    VARCHAR(64) NOT NULL UNIQUE,
    owner_name     VARCHAR(10) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL
);

-- The room's taste universe. A row exists only after the guest agreed to show their
-- match with the owner, under the given planet name.
CREATE TABLE universe_planet (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id   BIGINT      NOT NULL REFERENCES share_room (id) ON DELETE CASCADE,
    guest_id  BIGINT      NOT NULL REFERENCES guest (id) ON DELETE CASCADE,
    name      VARCHAR(10) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_universe_planet_guest UNIQUE (room_id, guest_id)
);
