-- An ad view is stored once per visitor, ad, spot and test within half an hour; this
-- finds the earlier one.
CREATE INDEX idx_event_ad_view ON event (guest_id, ad_id, created_at) WHERE type = 'AD_VIEW';
