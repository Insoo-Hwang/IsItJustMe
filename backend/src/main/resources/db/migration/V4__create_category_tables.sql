CREATE TABLE category (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        VARCHAR(50)    NOT NULL UNIQUE,
    name        VARCHAR(100)   NOT NULL,
    icon        VARCHAR(50)    NOT NULL,
    description VARCHAR(200)   NOT NULL,
    tagline     VARCHAR(200)   NOT NULL,
    minutes     INT            NOT NULL,
    recommend   VARCHAR(100)[] NOT NULL,
    sort_order  INT            NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Questions never change, so a bit position always means the same question.
-- bit_position is also the display order (0 = question 1).
CREATE TABLE question (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id  BIGINT       NOT NULL REFERENCES category (id),
    bit_position SMALLINT     NOT NULL,
    code         VARCHAR(50)  NOT NULL UNIQUE,
    prompt       VARCHAR(200) NOT NULL,
    option_0     VARCHAR(100) NOT NULL,
    option_1     VARCHAR(100) NOT NULL,
    CONSTRAINT uq_question_bit UNIQUE (category_id, bit_position),
    CONSTRAINT chk_question_bit_position CHECK (bit_position BETWEEN 0 AND 9)
);

-- One current answer per guest and category. gender and age_group are copied from the
-- guest at submit time, so combination_stats can always be rebuilt from this table.
CREATE TABLE category_answer (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guest_id     BIGINT      NOT NULL REFERENCES guest (id) ON DELETE CASCADE,
    category_id  BIGINT      NOT NULL REFERENCES category (id),
    gender       VARCHAR(10) NOT NULL,
    age_group    VARCHAR(20) NOT NULL,
    answer_bits  SMALLINT    NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_category_answer_guest UNIQUE (guest_id, category_id),
    CONSTRAINT chk_category_answer_bits CHECK (answer_bits BETWEEN 0 AND 1023),
    CONSTRAINT chk_category_answer_gender CHECK (gender IN ('FEMALE', 'MALE')),
    CONSTRAINT chk_category_answer_age_group CHECK (age_group IN ('TEENS', 'TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES_PLUS'))
);

CREATE INDEX idx_category_answer_category ON category_answer (category_id);

-- Number of answers per category, group and answer combination (at most 10,240 rows per category).
CREATE TABLE combination_stats (
    category_id       BIGINT      NOT NULL REFERENCES category (id),
    gender            VARCHAR(10) NOT NULL,
    age_group         VARCHAR(20) NOT NULL,
    answer_bits       SMALLINT    NOT NULL,
    participant_count BIGINT      NOT NULL,
    PRIMARY KEY (category_id, gender, age_group, answer_bits),
    CONSTRAINT chk_combination_stats_bits CHECK (answer_bits BETWEEN 0 AND 1023),
    CONSTRAINT chk_combination_stats_count CHECK (participant_count >= 0)
);
