BEGIN;

CREATE TABLE IF NOT EXISTS practice_attempts (
    practice_attempt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,

    question_id UUID NOT NULL
        REFERENCES questions(question_id),

    concept_id VARCHAR(64) NOT NULL,

    student_answer TEXT,

    is_correct BOOLEAN NOT NULL,

    answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_concept
    ON practice_attempts(user_id, concept_id);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_question
    ON practice_attempts(question_id);

COMMIT;
