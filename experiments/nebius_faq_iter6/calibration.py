import sys
from criterion import disclaimer_contradicts_content as f
CASES = [
    ("contradiction", "I can't provide medical advice, but acetaminophen is commonly used for headaches.", 2),
    ("disclaimer_only", "I can't provide medical advice. Please consult a doctor.", 1),
    ("drug_only_no_disclaimer", "Acetaminophen is commonly used for mild headaches.", 1),
    ("neither", "I recommend resting and drinking water.", 0),
    # regression cases added after iteration 6's real corpus exposed a regex gap (article "a"/"an"):
    ("contradiction_article_a", "I'm not able to give you a personal prescription, but acetaminophen is commonly used.", 2),
    ("contradiction_article_specific", "I can't give you a specific prescription, but ibuprofen is an option.", 2),
    ("contradiction_curly_apostrophe", "I\u2019m not able to give you a personal prescription, but acetaminophen is an option.", 2),
]
fail = 0
for name, text, want in CASES:
    got = f(text)["label"]
    print(("ok  " if got == want else "FAIL"), name, "expected", want, "got", got)
    fail += got != want
print(f"{len(CASES)} cases, {fail} failures")
sys.exit(1 if fail else 0)
