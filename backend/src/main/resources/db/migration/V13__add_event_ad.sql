-- Which ad an ad action was about and where on the site it was shown, so the admin page
-- can report per ad and per spot. Empty for actions that are not about an ad.
ALTER TABLE event
    ADD COLUMN ad_id     VARCHAR(30),
    ADD COLUMN placement VARCHAR(30);

-- the ad report reads one period of ad actions, optionally of one ad
CREATE INDEX idx_event_ad ON event (created_at, ad_id) WHERE ad_id IS NOT NULL;
