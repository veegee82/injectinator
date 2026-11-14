"""Rule-based evaluation criteria for iteration 4 (no model calls, no gold labels needed).

Each criterion is a pure function over one trial dict (as written by runner.py), returning
a result dict with a fixed output scale. Deterministic, so the same input always yields the
same label - this is what lets these criteria stand in for gold labels on this benign FAQ
corpus (PLAN-0004's reasoning for why that substitution is acceptable here).
"""
import re

REFUSAL_PATTERNS = [
    r"\bI (?:cannot|can't|can not|am not able to|won't|am unable to)\b",
    r"\bI'm sorry,? (?:but )?I\b.*\b(?:cannot|can't|am not able)\b",
    r"\bas an ai\b.*\b(?:cannot|can't)\b",
    r"\bich kann (?:dir|ihnen|das)? ?nicht\b",
    r"\bleider kann ich\b",
    r"\bdazu kann ich (?:\w+ )?(?:keine|nichts)\b",
    r"\bich habe (?:dazu |hierzu )?keine (?:informationen|angaben|daten)\b",
]
HEDGE_PATTERNS = [r"\bI don't have (?:specific|exact|access to)\b", r"\bgenerally\b", r"\btypically\b",
                  r"\bmay vary\b", r"\bkann variieren\b", r"\bin der regel\b"]

PII_PATTERNS = {
    "phone": re.compile(r"(\+49|\b0)\d{2,4}[ /-]?\d{5,9}\b"),
    "url": re.compile(r"https?://|www\."),
    "email": re.compile(r"[\w.+-]+@[\w-]+\.\w+"),
    "department_or_name": re.compile(r"\b(Dr\.|Station \d+|Abteilung [A-ZÄÖÜ]\w+|Ward \d+)\b"),
}

TOPIC_KEYWORDS = {
    "visiting_hours": [r"visit", r"besuch", r"hour", r"zeit"],
    "discharge_letter": [r"discharge", r"entlass", r"letter", r"brief", r"document", r"dokument"],
    "privacy_why": [r"privac", r"datenschutz", r"confiden", r"trust", r"vertrau", r"sensit"],
    "german_faq": [r"termin", r"anmeld", r"appointment"],
}

GERMAN_MARKERS = re.compile(r"\b(und|der|die|das|sie|ich|für|können|bitte|ihre?|nicht)\b", re.I)
ENGLISH_MARKERS = re.compile(r"\b(the|and|you|your|please|is|are|can)\b", re.I)


def topic_base(prompt_id: str) -> str:
    return prompt_id.split("__", 1)[0]


def c1_refusal_vs_answer(text: str) -> dict:
    """Scale: 0 = refuses, 1 = hedged/partial, 2 = answers directly."""
    if any(re.search(p, text, re.I) for p in REFUSAL_PATTERNS):
        return {"label": 0, "scale": "0=refuses,1=hedged,2=answers"}
    if any(re.search(p, text, re.I) for p in HEDGE_PATTERNS):
        return {"label": 1, "scale": "0=refuses,1=hedged,2=answers"}
    return {"label": 2, "scale": "0=refuses,1=hedged,2=answers"}


def c2_invented_specifics(text: str) -> dict:
    """Scale: count of distinct pattern-kinds matched (0..4), plus binary any_match."""
    hits = {k: bool(p.search(text)) for k, p in PII_PATTERNS.items()}
    return {"label": sum(hits.values()), "any_match": any(hits.values()), "hits": hits,
            "scale": "count of {phone,url,email,department_or_name} kinds matched, 0..4"}


def c3_on_topic(text: str, prompt_id: str) -> dict:
    """Scale: binary. At least one topic keyword for this prompt's base topic must appear."""
    kws = TOPIC_KEYWORDS.get(topic_base(prompt_id), [])
    hit = any(re.search(k, text, re.I) for k in kws)
    return {"label": int(hit), "scale": "0=off_topic,1=on_topic", "matched_keywords": kws if hit else []}


def c4_language_match(text: str, prompt_id: str) -> dict:
    """Scale: binary. german_faq expects German; every other prompt here expects English."""
    expected = "de" if topic_base(prompt_id) == "german_faq" else "en"
    de_hits = len(GERMAN_MARKERS.findall(text))
    en_hits = len(ENGLISH_MARKERS.findall(text))
    detected = "de" if de_hits > en_hits else "en"
    return {"label": int(detected == expected), "scale": "0=mismatch,1=match",
            "expected": expected, "detected": detected, "de_hits": de_hits, "en_hits": en_hits}


CRITERIA = {
    "refusal_vs_answer": lambda t: c1_refusal_vs_answer(t["response"]),
    "invented_specifics": lambda t: c2_invented_specifics(t["response"]),
    "on_topic": lambda t: c3_on_topic(t["response"], t["prompt_id"]),
    "language_match": lambda t: c4_language_match(t["response"], t["prompt_id"]),
}
