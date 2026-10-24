
"""
Marg.ai — Expert Syllabus Concept Extraction

Pipeline:
    Syllabus text -> Groq/LLM -> Structured curriculum -> Neo4j

Endpoint:
    POST /concepts/extract

Request:
    syllabusId, subjectId, rawText

Response:
    units -> topics -> concepts
"""

import json
import re
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError

from app.llm_client import llm
from app.neo4j_client import run_query


router = APIRouter(prefix="/concepts", tags=["concepts"])


# =========================================================
# REQUEST AND RESPONSE MODELS
# =========================================================

class ExtractRequest(BaseModel):
    syllabusId: str
    subjectId: str
    rawText: str = Field(min_length=1)


class ConceptOut(BaseModel):
    id: str
    label: str


class TopicOut(BaseModel):
    title: str
    order: int
    concepts: List[ConceptOut]


class UnitOut(BaseModel):
    title: str
    order: int
    topics: List[TopicOut]


class ExtractResponse(BaseModel):
    units: List[UnitOut]


# =========================================================
# EXPERT-LEVEL ACADEMIC PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are an elite academic curriculum analyst, subject-matter expert,
educational knowledge engineer, and learning-path architect.

You have expert-level knowledge of university curricula, academic syllabus
interpretation, instructional design, concept decomposition, and knowledge
graph modeling across technical and non-technical disciplines.

Your task is to transform the supplied syllabus into a precise, comprehensive,
well-organized, machine-readable academic knowledge structure.

Apply the rigor of:
1. A senior university professor with deep subject knowledge.
2. An experienced curriculum designer who understands academic hierarchies.
3. An educational AI researcher who identifies independently teachable
   concepts.
4. A knowledge-graph engineer who creates meaningful concept identifiers.
5. An academic quality auditor who checks completeness, ordering,
   duplication, and source fidelity.

SOURCE FIDELITY
- Treat the supplied syllabus as the primary source of truth.
- Do not invent units, topics, concepts, or learning outcomes.
- Do not introduce unrelated textbook content.
- Preserve the meaning and sequence of the original syllabus.
- Correct obvious OCR errors only when the intended wording is unambiguous.
- Do not claim completeness when the source text is incomplete.

UNIT EXTRACTION
- Identify every explicitly stated unit, module, chapter, or equivalent
  major section.
- Preserve original ordering and numbering where available.
- Create logical groupings only when explicit unit boundaries are absent
  and the content supports those groupings.
- Never invent units merely to reach a target count.

TOPIC EXTRACTION
- Identify meaningful topics and subtopics.
- Preserve their original hierarchy and ordering as closely as possible.
- Do not combine unrelated topics.
- Do not split topics into artificial fragments.
- Use concise, academically appropriate titles.

CONCEPT DECOMPOSITION
- Decompose topics into distinct, teachable concepts.
- A concept may be a principle, theory, method, model, algorithm, process,
  technique, formula, or other subject-specific knowledge element.
- Separate ideas when they require different explanations or assessments.
- Avoid redundant concepts and vague labels when more specific information
  is present in the syllabus.
- Preserve technical terminology, acronyms, and named methods.
- Do not turn administrative or grading information into academic concepts
  unless it is itself learning content.

COMPLETENESS AND QUALITY CONTROL
Before returning the result, verify that:
- Every identifiable unit and topic has been considered.
- Major supported topics have not been silently omitted.
- Every concept belongs to its parent topic.
- Duplicate concepts have been removed.
- Original ordering is preserved.
- Labels are clear and academically meaningful.
- The response follows the required JSON structure exactly.

CONCEPT IDENTIFIERS
- Create stable, meaningful identifiers.
- Use "domain.concept_slug" when the subject domain is identifiable.
- Examples:
  "dbms.normalization"
  "dbms.functional_dependencies"
  "os.process_scheduling"
  "networks.ip_addressing"
  "mathematics.linear_equations"
- Use lowercase snake_case after the domain prefix.
- Determine the domain from the supplied syllabus.
- Do not assume every syllabus belongs to computer science.
- Use consistent IDs for repeated occurrences of the same concept.
- Do not use random IDs, timestamps, or UUIDs.
- Do not claim that an ID matches an existing database record unless
  that mapping has been verified.

STRICT OUTPUT CONTRACT
Return only a valid JSON object with this structure:

{
  "units": [
    {
      "title": "Unit title",
      "topics": [
        {
          "title": "Topic title",
          "concepts": [
            {
              "id": "domain.concept_slug",
              "label": "Concept name"
            }
          ]
        }
      ]
    }
  ]
}

- Every unit must contain "title" and "topics".
- Every topic must contain "title" and "concepts".
- Every concept must contain "id" and "label".
- Use valid JSON with double-quoted keys and string values.
- Do not include Markdown fences, explanations, or extra fields.
- If no meaningful academic content is present, return {"units": []}.

SCOPE LIMITATION
This stage extracts syllabus structure and concepts only.
Do not generate questions, lesson plans, explanations, or prerequisite
relationships. Those belong to separate pipeline stages.
"""


# =========================================================
# TEXT CLEANING
# =========================================================

def clean_syllabus_text(raw_text: str) -> str:
    """Normalize whitespace while preserving syllabus content."""

    text = raw_text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# =========================================================
# JSON PARSING
# =========================================================

def parse_json_response(content: str) -> dict:
    """Parse JSON returned by the LLM, tolerating optional code fences."""

    if not content or not content.strip():
        raise ValueError("The LLM returned an empty response.")

    cleaned = content.strip()

    # Remove optional Markdown fences.
    cleaned = re.sub(
        r"^\s*```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)

    try:
        result = json.loads(cleaned)

    except json.JSONDecodeError:
        # Recover a JSON object if the model added surrounding prose.
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end <= start:
            raise ValueError(
                "The LLM response does not contain a JSON object."
            )

        result = json.loads(cleaned[start:end + 1])

    if not isinstance(result, dict):
        raise ValueError("The LLM response must be a JSON object.")

    return result


# =========================================================
# CONCEPT ID HELPERS
# =========================================================

def slugify(value: str) -> str:
    """Create a deterministic identifier from a label."""

    slug = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")

    return slug or "unnamed_concept"


def normalize_concept_id(concept_id: str, label: str) -> str:
    """Normalize an ID while retaining a supplied domain prefix."""

    concept_id = concept_id.strip().lower()

    if not concept_id:
        return slugify(label)

    if "." in concept_id:
        domain, slug = concept_id.split(".", 1)
        return f"{slugify(domain)}.{slugify(slug)}"

    return slugify(concept_id)


# =========================================================
# STRUCTURE VALIDATION
# =========================================================

def normalize_extracted_data(data: dict) -> ExtractResponse:
    """Validate units, topics, concepts, and identifiers."""

    raw_units = data.get("units")

    if not isinstance(raw_units, list):
        raise ValueError('The LLM response must contain a "units" list.')

    if not raw_units:
        return ExtractResponse(units=[])

    normalized_units = []
    used_concept_ids = set()

    for unit_index, raw_unit in enumerate(raw_units):
        if not isinstance(raw_unit, dict):
            raise ValueError(f"Unit {unit_index + 1} is invalid.")

        unit_title = str(raw_unit.get("title", "")).strip()

        if not unit_title:
            raise ValueError(f"Unit {unit_index + 1} has no title.")

        raw_topics = raw_unit.get("topics", [])

        if not isinstance(raw_topics, list):
            raise ValueError(
                f"Topics in unit {unit_title!r} must be a list."
            )

        normalized_topics = []

        for topic_index, raw_topic in enumerate(raw_topics):
            if not isinstance(raw_topic, dict):
                raise ValueError(
                    f"Topic {topic_index + 1} in {unit_title!r} is invalid."
                )

            topic_title = str(raw_topic.get("title", "")).strip()

            if not topic_title:
                raise ValueError(
                    f"A topic in unit {unit_title!r} has no title."
                )

            raw_concepts = raw_topic.get("concepts", [])

            if not isinstance(raw_concepts, list):
                raise ValueError(
                    f"Concepts in topic {topic_title!r} must be a list."
                )

            normalized_concepts = []

            for raw_concept in raw_concepts:
                if isinstance(raw_concept, str):
                    raw_concept = {"label": raw_concept}

                if not isinstance(raw_concept, dict):
                    raise ValueError(
                        f"A concept in topic {topic_title!r} is invalid."
                    )

                label = str(raw_concept.get("label", "")).strip()

                if not label:
                    continue

                supplied_id = str(raw_concept.get("id", "")).strip()
                concept_id = normalize_concept_id(supplied_id, label)

                if concept_id in used_concept_ids:
                    raise ValueError(
                        f"Duplicate concept ID {concept_id!r}. "
                        "Ensure each distinct concept has a unique ID and "
                        "repeated concepts are not emitted more than once."
                    )

                used_concept_ids.add(concept_id)

                normalized_concepts.append(
                    ConceptOut(
                        id=concept_id,
                        label=label,
                    )
                )

            if normalized_concepts:
                normalized_topics.append(
                    TopicOut(
                        title=topic_title,
                        order=topic_index,
                        concepts=normalized_concepts,
                    )
                )

        if normalized_topics:
            normalized_units.append(
                UnitOut(
                    title=unit_title,
                    order=unit_index,
                    topics=normalized_topics,
                )
            )

    return ExtractResponse(units=normalized_units)


# =========================================================
# LLM EXTRACTION WITH ONE RETRY
# =========================================================


def extract_structure(raw_text: str) -> ExtractResponse:
    """Extract and validate a structured curriculum from syllabus text."""

    user_prompt = (
        "Analyze this syllabus as an expert academic curriculum analyst. "
        "Extract all supported units, topics, and teachable concepts.\n\n"
        "Return exactly one valid JSON object matching this structure:\n"
        '{"units":[{"title":"Unit title","topics":['
        '{"title":"Topic title","concepts":['
        '{"id":"domain.concept_slug","label":"Concept name"}]}]}]}\n\n'
        "Requirements:\n"
        "- Return only JSON, without Markdown or code fences.\n"
        "- Preserve the original unit and topic order where available.\n"
        "- Use only information supported by the supplied syllabus.\n"
        "- Give each concept a meaningful, unique ID and label.\n\n"
        "BEGIN SYLLABUS TEXT\n"
        f"{raw_text}\n"
        "END SYLLABUS TEXT"
    )

    try:
        content = llm.complete(
            system=SYSTEM_PROMPT,
            user=user_prompt,
            max_tokens=6000,
            response_format=None,
        )

        parsed = parse_json_response(content)
        return normalize_extracted_data(parsed)

    except (ValueError, ValidationError) as first_error:
        print(
            "[concept-extraction] First response was invalid. "
            f"Retrying once. Error: {first_error}"
        )

    retry_content = llm.complete(
        system=(
            "You are an expert academic curriculum analyst. "
            "Return only one valid JSON object, without Markdown, "
            "code fences, comments, or explanations. Use this structure: "
            '{"units":[{"title":"Unit title","topics":['
            '{"title":"Topic title","concepts":['
            '{"id":"domain.concept_slug","label":"Concept name"}]}]}]}. '
            "Use only information supported by the supplied syllabus."
        ),
        user=user_prompt,
        max_tokens=6000,
        response_format=None,
    )

    try:
        parsed = parse_json_response(retry_content)
        return normalize_extracted_data(parsed)

    except (ValueError, ValidationError) as exc:
        print(
            "[concept-extraction] Retry response preview:",
            repr(retry_content[:1500]),
        )
        raise ValueError(
            "The LLM returned invalid curriculum JSON after two attempts. "
            "Check the AI-service terminal for response previews."
        ) from exc



# =========================================================
# NEO4J KNOWLEDGE GRAPH WRITING
# =========================================================

def write_concepts_to_graph(
    subject_id: str,
    units: List[UnitOut],
):
    """
    Create or update Subject, Unit, Topic, and Concept nodes.

    MERGE makes writes idempotent for stable IDs. Prerequisite relationships
    are not created by this function.
    """

    run_query(
        """
        MERGE (s:Subject {id: $subjectId})
        """,
        subjectId=subject_id,
    )

    for unit_index, unit in enumerate(units):
        unit_id = f"{subject_id}.u{unit_index}"

        run_query(
            """
            MERGE (u:Unit {id: $unitId})
            SET u.title = $title,
                u.order = $order
            WITH u
            MATCH (s:Subject {id: $subjectId})
            MERGE (s)-[:HAS_UNIT]->(u)
            """,
            unitId=unit_id,
            title=unit.title,
            order=unit.order,
            subjectId=subject_id,
        )

        for topic_index, topic in enumerate(unit.topics):
            topic_id = f"{unit_id}.t{topic_index}"

            run_query(
                """
                MERGE (t:Topic {id: $topicId})
                SET t.title = $title,
                    t.order = $order
                WITH t
                MATCH (u:Unit {id: $unitId})
                MERGE (u)-[:HAS_TOPIC]->(t)
                """,
                topicId=topic_id,
                title=topic.title,
                order=topic.order,
                unitId=unit_id,
            )

            for concept in topic.concepts:
                run_query(
                    """
                    MERGE (c:Concept {id: $conceptId})
                    SET c.label = $label
                    WITH c
                    MATCH (t:Topic {id: $topicId})
                    MERGE (t)-[:HAS_CONCEPT]->(c)
                    """,
                    conceptId=concept.id,
                    label=concept.label,
                    topicId=topic_id,
                )


# =========================================================
# API ENDPOINT
# =========================================================

@router.post("/extract", response_model=ExtractResponse)
def extract_concepts(req: ExtractRequest):
    """Extract syllabus concepts and write the hierarchy to Neo4j."""

    raw_text = clean_syllabus_text(req.rawText)

    if not raw_text:
        raise HTTPException(
            status_code=400,
            detail="The syllabus text is empty.",
        )

    max_characters = 30000

    if len(raw_text) > max_characters:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Syllabus text contains {len(raw_text)} characters. "
                f"The maximum supported length is {max_characters}. "
                "Split the syllabus into smaller sections."
            ),
        )

    try:
        extracted = extract_structure(raw_text)

    except (ValueError, ValidationError) as exc:
        print(f"[concept-extraction] Validation failed: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not validate the LLM extraction. "
                "Check the AI-service terminal for response previews."
            ),
        ) from exc

    except Exception as exc:
        print(f"[concept-extraction] LLM request failed: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "Syllabus concept extraction failed. "
                "Check the AI-service terminal for details."
            ),
        ) from exc

    if not extracted.units:
        raise HTTPException(
            status_code=422,
            detail=(
                "No academic units could be extracted. "
                "Check that the supplied text contains syllabus content."
            ),
        )

    try:
        write_concepts_to_graph(
            subject_id=req.subjectId,
            units=extracted.units,
        )

    except Exception as exc:
        print(f"[concept-extraction] Neo4j write failed: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "Extraction succeeded, but the knowledge graph could not "
                "be updated. Check Neo4j connectivity and service logs."
            ),
        ) from exc

    return extracted


# =========================================================
# FUTURE PREREQUISITE INFERENCE
# =========================================================

def infer_prerequisites(concept_ids: List[str]) -> List[dict]:
    """
    Future extension for prerequisite inference.

    Prerequisite relationships should be validated before creating
    REQUIRES edges in Neo4j.
    """

    raise NotImplementedError(
        "Prerequisite inference has not been implemented yet."
    )
