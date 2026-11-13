-- The owner's and the friend's answers from the moment the friend joined, so the owner can
-- see them question by question and they stay in line with the match shown. Planets from
-- before this get the answers as they are now, and their match is counted again from them
-- so the dots and the number agree.
ALTER TABLE universe_planet
    ADD COLUMN owner_bits  BIGINT,
    ADD COLUMN planet_bits BIGINT;

UPDATE universe_planet p
SET owner_bits    = oa.overall_bits,
    planet_bits   = pa.overall_bits,
    match_percent = ROUND((60 - bit_count((oa.overall_bits # pa.overall_bits)::BIT(64))) * 100.0 / 60)::INT
FROM share_room r
JOIN overall_answer oa ON oa.guest_id = r.owner_guest_id,
     overall_answer pa
WHERE r.id = p.room_id
  AND pa.guest_id = p.guest_id;
