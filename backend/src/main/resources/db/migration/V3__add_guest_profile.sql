ALTER TABLE guest
    ADD COLUMN gender    VARCHAR(10),
    ADD COLUMN age_group VARCHAR(20),
    ADD CONSTRAINT chk_guest_gender CHECK (gender IN ('FEMALE', 'MALE')),
    ADD CONSTRAINT chk_guest_age_group CHECK (age_group IN ('TEENS', 'TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES_PLUS')),
    ADD CONSTRAINT chk_guest_profile_complete CHECK ((gender IS NULL) = (age_group IS NULL));
