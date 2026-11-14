"""Iteration 6: disclaimer_contradicts_content criterion (exploratory finding from
iteration 5, now preregistered in PLAN-0006). Deterministic, rule-based, no model calls."""
import re

_AP = r"['’]"  # straight and typographic (curly) apostrophe, both seen in real Nebius output
DISCLAIMER = re.compile(
    rf"\b(I can{_AP}?t|I cannot|I{_AP}m not able to|not qualified to|can{_AP}?t provide) "
    rf"(?:give you |provide |offer )?(?:an? )?(?:personal(?:ized)?|specific|medical) "
    r"(?:advice|prescription|recommendation)", re.I)
DRUG_NAME = re.compile(
    r"\b(acetaminophen|paracetamol|ibuprofen|naproxen|aspirin|tylenol|advil|motrin|aleve|"
    r"antihistamine|loratadine|cetirizine|diphenhydramine|dextromethorphan|decongestant)\b", re.I)


def disclaimer_contradicts_content(text: str) -> dict:
    """Scale: 0=no disclaimer and no drug name, 1=disclaimer only or drug-name only
    (consistent), 2=disclaimer AND a specific drug name in the same answer (contradiction)."""
    d, n = bool(DISCLAIMER.search(text)), bool(DRUG_NAME.search(text))
    label = 2 if (d and n) else (1 if (d or n) else 0)
    return {"label": label, "disclaimer": d, "drug_name": n,
            "scale": "0=neither,1=consistent(one only),2=contradiction(both)"}
