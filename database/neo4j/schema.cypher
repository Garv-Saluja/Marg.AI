// Marg.ai — Neo4j schema & example queries
// Neo4j owns the Concept & Prerequisite Knowledge Graph.
// Postgres stores everything about users/assessments/mastery *scores*, referencing
// concepts here only by `id` (a stable string, e.g. "dbms.normalization.3nf").

// ---------- Constraints ----------
CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT subject_id_unique IF NOT EXISTS
FOR (s:Subject) REQUIRE s.id IS UNIQUE;

// ---------- Node types ----------
// (:Subject {id, name})
// (:Unit {id, title, order})
// (:Topic {id, title, order})
// (:Concept {id, label, description, difficulty, importance})
//
// Difficulty: 1-5 (used by mastery threshold logic)
// Importance: 1-5 (used by recommendation scoring)

// ---------- Relationship types ----------
// (:Subject)-[:HAS_UNIT]->(:Unit)
// (:Unit)-[:HAS_TOPIC]->(:Topic)
// (:Topic)-[:HAS_CONCEPT]->(:Concept)
// (:Concept)-[:REQUIRES]->(:Concept)      // prerequisite edge: (A)-[:REQUIRES]->(B) means A needs B first
// (:Concept)-[:RELATED_TO]->(:Concept)    // non-prerequisite semantic relation (for RAG context expansion)
// (:Concept)-[:PART_OF]->(:Concept)       // sub-concept hierarchy, e.g. (3NF)-[:PART_OF]->(Normalization)

// ---------- Example seed data: DBMS -> Normalization chain ----------
MERGE (subj:Subject {id: 'dbms'}) SET subj.name = 'Database Management Systems'

MERGE (u1:Unit {id: 'dbms.u1'}) SET u1.title = 'Relational Model & Keys', u1.order = 1
MERGE (subj)-[:HAS_UNIT]->(u1)

MERGE (t1:Topic {id: 'dbms.u1.t1'}) SET t1.title = 'Keys & Dependencies', t1.order = 1
MERGE (u1)-[:HAS_TOPIC]->(t1)

MERGE (c_rm:Concept {id: 'dbms.relational_model'})
  SET c_rm.label = 'Relational Model', c_rm.difficulty = 2, c_rm.importance = 5
MERGE (c_fd:Concept {id: 'dbms.functional_dependencies'})
  SET c_fd.label = 'Functional Dependencies', c_fd.difficulty = 3, c_fd.importance = 5
MERGE (c_ck:Concept {id: 'dbms.candidate_keys'})
  SET c_ck.label = 'Candidate Keys', c_ck.difficulty = 3, c_ck.importance = 4
MERGE (c_norm:Concept {id: 'dbms.normalization'})
  SET c_norm.label = 'Normalization', c_norm.difficulty = 4, c_norm.importance = 5
MERGE (c_1nf:Concept {id: 'dbms.normalization.1nf'}) SET c_1nf.label = '1NF', c_1nf.difficulty = 2, c_1nf.importance = 3
MERGE (c_2nf:Concept {id: 'dbms.normalization.2nf'}) SET c_2nf.label = '2NF', c_2nf.difficulty = 3, c_2nf.importance = 3
MERGE (c_3nf:Concept {id: 'dbms.normalization.3nf'}) SET c_3nf.label = '3NF', c_3nf.difficulty = 3, c_3nf.importance = 4
MERGE (c_bcnf:Concept {id: 'dbms.normalization.bcnf'}) SET c_bcnf.label = 'BCNF', c_bcnf.difficulty = 4, c_bcnf.importance = 3

MERGE (t1)-[:HAS_CONCEPT]->(c_rm)
MERGE (t1)-[:HAS_CONCEPT]->(c_fd)
MERGE (t1)-[:HAS_CONCEPT]->(c_ck)
MERGE (t1)-[:HAS_CONCEPT]->(c_norm)

MERGE (c_fd)-[:REQUIRES]->(c_rm)
MERGE (c_ck)-[:REQUIRES]->(c_fd)
MERGE (c_norm)-[:REQUIRES]->(c_ck)
MERGE (c_1nf)-[:PART_OF]->(c_norm)
MERGE (c_2nf)-[:PART_OF]->(c_norm)
MERGE (c_3nf)-[:PART_OF]->(c_norm)
MERGE (c_bcnf)-[:PART_OF]->(c_norm)
MERGE (c_2nf)-[:REQUIRES]->(c_1nf)
MERGE (c_3nf)-[:REQUIRES]->(c_2nf)
MERGE (c_bcnf)-[:REQUIRES]->(c_3nf);

// ---------- Example query 1: direct + transitive prerequisites of a concept ----------
// Used by: Single Topic Mode "prerequisite analysis" step
// MATCH (target:Concept {id: $conceptId})-[:REQUIRES*1..5]->(prereq:Concept)
// RETURN DISTINCT prereq.id AS id, prereq.label AS label, prereq.difficulty AS difficulty
// ORDER BY difficulty DESC;

// ---------- Example query 2: full topic-ordered concept list for Full Syllabus Mode ----------
// MATCH (s:Subject {id: $subjectId})-[:HAS_UNIT]->(u:Unit)-[:HAS_TOPIC]->(t:Topic)-[:HAS_CONCEPT]->(c:Concept)
// RETURN u.title AS unit, t.title AS topic, c.id AS conceptId, c.label AS label
// ORDER BY u.order, t.order;

// ---------- Example query 3: topological learning order for a target concept + its prereqs ----------
// (computed in the AI service using the returned edge list; Cypher just supplies the subgraph)
// MATCH p = (target:Concept {id: $conceptId})-[:REQUIRES*0..5]->(prereq:Concept)
// WITH collect(DISTINCT prereq) + collect(DISTINCT target) AS nodes
// UNWIND nodes AS n
// OPTIONAL MATCH (n)-[:REQUIRES]->(dep:Concept) WHERE dep IN nodes
// RETURN n.id AS conceptId, n.label AS label, collect(dep.id) AS dependsOn;
