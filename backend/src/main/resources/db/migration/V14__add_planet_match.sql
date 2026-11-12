-- The planet's match with the owner, fixed when the planet joins. Worked out again on
-- every view, an owner could retake the tests one answer at a time and read each friend's
-- answers from how their match moved. Empty for planets that joined before this column.
ALTER TABLE universe_planet ADD COLUMN match_percent INTEGER;
