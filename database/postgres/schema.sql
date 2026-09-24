-- Marg.ai — PostgreSQL schema
-- Postgres owns: users, syllabus structure metadata, assessments, attempts,
-- mastery scores (cached snapshot), learning sessions, AI interaction logs.
-- Neo4j owns: concepts, prerequisite edges, concept hierarchy (see neo4j/schema.cypher).
-- Concepts are referenced here only by their Neo4j concept_id (a string/UUID), never duplicated.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'student', -- student | (future: teacher/admin)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- SUBJECT / SYLLABUS STRUCTURE
-- =========================
CREATE TABLE subjects (
    subject_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50),
    created_by      UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE syllabi (
    syllabus_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(user_id),
    original_filename VARCHAR(255),
    raw_text        TEXT,               -- extracted text from PDF/doc
    status          VARCHAR(30) NOT NULL DEFAULT 'uploaded', -- uploaded|processing|processed|failed
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units (
    unit_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    syllabus_id     UUID NOT NULL REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    order_index     INT NOT NULL DEFAULT 0
);

CREATE TABLE topics (
    topic_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    order_index     INT NOT NULL DEFAULT 0
);

-- Concepts live in Neo4j. This table is a thin pointer/index so Postgres can
-- join concept_id -> topic without duplicating graph structure.
CREATE TABLE topic_concepts (
    topic_id        UUID NOT NULL REFERENCES topics(topic_id) ON DELETE CASCADE,
    concept_id      VARCHAR(64) NOT NULL,  -- matches Concept.id in Neo4j
    concept_label   VARCHAR(255) NOT NULL, -- denormalized for display without a graph round-trip
    PRIMARY KEY (topic_id, concept_id)
);

-- =========================
-- QUESTIONS / PRACTICE BANK
-- =========================
CREATE TABLE questions (
    question_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id      VARCHAR(64) NOT NULL,  -- primary concept this question tests
    question_type   VARCHAR(30) NOT NULL,  -- mcq|conceptual|short_answer|problem_solving|exam_style
    difficulty      VARCHAR(20) NOT NULL DEFAULT 'medium', -- easy|medium|hard
    body            TEXT NOT NULL,
    options         JSONB,                 -- for MCQ: [{id,text}], null otherwise
    correct_answer  TEXT,                  -- answer key or option id
    source          VARCHAR(20) NOT NULL DEFAULT 'bank', -- bank|ai_generated
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_concepts (
    -- a question may reinforce multiple concepts (e.g. a JOIN + normalization question)
    question_id     UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    concept_id      VARCHAR(64) NOT NULL,
    weight          NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    PRIMARY KEY (question_id, concept_id)
);

-- =========================
-- ASSESSMENTS & ATTEMPTS
-- =========================
CREATE TABLE assessments (
    assessment_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assessment_type VARCHAR(30) NOT NULL,  -- diagnostic|post_teaching|reassessment
    scope           VARCHAR(30) NOT NULL,  -- full_syllabus|single_topic
    subject_id      UUID REFERENCES subjects(subject_id),
    target_concept_id VARCHAR(64),         -- set when scope = single_topic
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress' -- in_progress|completed|abandoned
);

CREATE TABLE assessment_questions (
    assessment_id   UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(question_id),
    order_index     INT NOT NULL,
    PRIMARY KEY (assessment_id, question_id)
);

CREATE TABLE attempts (
    attempt_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id   UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(question_id),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    student_answer  TEXT,
    is_correct      BOOLEAN,
    score           NUMERIC(4,2),          -- for partial-credit question types
    time_taken_sec  INT,
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- STUDENT KNOWLEDGE PROFILE (mastery cache)
-- =========================
-- This is the queryable, always-up-to-date snapshot. The AI service computes
-- updates; the backend persists them here so the dashboard can read cheaply
-- without calling the AI service or Neo4j on every page load.
CREATE TABLE concept_mastery (
    user_id             UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id          VARCHAR(64) NOT NULL,
    concept_label       VARCHAR(255) NOT NULL,
    mastery_score       NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0-100
    confidence          NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0-100, based on #attempts/recency
    attempts_count      INT NOT NULL DEFAULT 0,
    correct_count       INT NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'not_started', -- not_started|weak|in_progress|mastered
    last_assessed_at    TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, concept_id)
);

CREATE TABLE mastery_history (
    -- append-only log so "Progress" screens can chart mastery over time
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id      VARCHAR(64) NOT NULL,
    mastery_score   NUMERIC(5,2) NOT NULL,
    reason          VARCHAR(50) NOT NULL, -- diagnostic|post_teaching|reassessment|decay
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- LEARNING PATHS & SESSIONS
-- =========================
CREATE TABLE learning_paths (
    learning_path_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    scope           VARCHAR(30) NOT NULL, -- full_syllabus|single_topic
    subject_id      UUID REFERENCES subjects(subject_id),
    target_concept_id VARCHAR(64),        -- set when scope = single_topic
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active|completed|abandoned
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learning_path_steps (
    step_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_path_id UUID NOT NULL REFERENCES learning_paths(learning_path_id) ON DELETE CASCADE,
    concept_id      VARCHAR(64) NOT NULL,
    concept_label   VARCHAR(255) NOT NULL,
    order_index     INT NOT NULL,
    reason          VARCHAR(50), -- e.g. "missing_prerequisite" | "target_concept" | "revision"
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' -- pending|in_progress|completed|skipped
);

CREATE TABLE learning_sessions (
    session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    step_id         UUID REFERENCES learning_path_steps(step_id),
    concept_id      VARCHAR(64) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    explanation_mode VARCHAR(30) -- simple|detailed|example|step_by_step|exam_oriented|mistake|practice_request
);

-- =========================
-- AI INTERACTIONS (doubt support / RAG log)
-- =========================
CREATE TABLE ai_interactions (
    interaction_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id      VARCHAR(64),
    session_id      UUID REFERENCES learning_sessions(session_id),
    interaction_type VARCHAR(30) NOT NULL, -- explanation|doubt|reteach|question_generation
    user_message    TEXT,
    ai_response     TEXT,
    retrieved_context JSONB,               -- chunks/sources used by RAG, for transparency/eval
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- RESOURCES (uploaded notes etc., feeds the RAG vector store)
-- =========================
CREATE TABLE resources (
    resource_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      UUID REFERENCES subjects(subject_id),
    concept_id      VARCHAR(64),
    uploaded_by     UUID REFERENCES users(user_id),
    resource_type   VARCHAR(30) NOT NULL, -- syllabus|notes|curated|ai_generated
    title           VARCHAR(255),
    storage_path    TEXT,                 -- file path / object storage key
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_concept_mastery_user ON concept_mastery(user_id);
CREATE INDEX idx_mastery_history_user_concept ON mastery_history(user_id, concept_id);
CREATE INDEX idx_attempts_user ON attempts(user_id);
CREATE INDEX idx_learning_path_steps_path ON learning_path_steps(learning_path_id);
CREATE INDEX idx_question_concepts_concept ON question_concepts(concept_id);
