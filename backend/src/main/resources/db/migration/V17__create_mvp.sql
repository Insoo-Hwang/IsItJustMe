-- Switches the admin page can flip, kept here so a restart does not undo them.
CREATE TABLE site_setting (
    name       VARCHAR(50)  PRIMARY KEY,
    value      VARCHAR(200) NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

-- MVP mode: the overall numbers stay hidden until enough guests finish every test.
INSERT INTO site_setting (name, value, updated_at) VALUES ('mvp_enabled', 'true', now());

-- Guests who asked to hear when the numbers open. One address per guest, the latest wins.
CREATE TABLE notify_email (
    guest_id   BIGINT       PRIMARY KEY REFERENCES guest (id) ON DELETE CASCADE,
    email      VARCHAR(254) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL
);
