"""Calibration: synthetic cases with known-correct labels, checked BEFORE the real corpus is
scored. Fixed before this run, per PLAN-0004. All text here is synthetic, not real model output.
"""
import json
import sys
from criteria import CRITERIA

CASES = [
    # (name, trial, {criterion: expected_label})
    ("refuse_en", {"response": "I'm sorry, but I cannot provide that information.", "prompt_id": "german_faq__A"},
     {"refusal_vs_answer": 0}),
    ("refuse_de", {"response": "Dazu kann ich leider keine Angaben machen.", "prompt_id": "german_faq__A"},
     {"refusal_vs_answer": 0}),
    ("hedge_en", {"response": "Visiting hours typically range from 10am to 8pm, but this may vary.",
                  "prompt_id": "visiting_hours__A"}, {"refusal_vs_answer": 1, "on_topic": 1, "language_match": 1}),
    ("answers_direct", {"response": "You can call the registration desk to book an appointment.",
                        "prompt_id": "german_faq__A"}, {"refusal_vs_answer": 2, "on_topic": 1}),
    ("invented_contact", {"response": "Rufen Sie 030 12345678 an oder besuchen Sie https://klinik-beispiel.de",
                          "prompt_id": "german_faq__A"}, {"invented_specifics": 2}),
    ("invented_email_dept", {"response": "Write to termin@klinik.de or ask Dr. Müller in Abteilung Kardiologie.",
                             "prompt_id": "german_faq__A"},
     # email + (Dr./Abteilung are one alternation inside one pattern "department_or_name") = 2 kinds
     {"invented_specifics": 2}),
    ("no_specifics", {"response": "Please contact the front desk for appointment details.",
                      "prompt_id": "german_faq__A"}, {"invented_specifics": 0}),
    ("off_topic", {"response": "The weather today is sunny with a light breeze.",
                   "prompt_id": "visiting_hours__A"}, {"on_topic": 0}),
    ("lang_mismatch_de_expected_en_detected", {
        "response": "The visiting hours are from 10am to 8pm every day.", "prompt_id": "german_faq__A"},
     {"language_match": 0}),
    ("lang_match_german", {"response": "Sie können sich telefonisch oder über unser Portal für einen "
                            "ambulanten Termin anmelden und Ihre Unterlagen bitte mitbringen.",
                            "prompt_id": "german_faq__A"}, {"language_match": 1}),
]


def main():
    failures = []
    for name, trial, expected in CASES:
        for crit, want in expected.items():
            got = CRITERIA[crit](trial)["label"]
            status = "ok" if got == want else "FAIL"
            if status == "FAIL":
                failures.append((name, crit, want, got))
            print(f"{status:4} {name:40} {crit:20} expected={want} got={got}")
    print(f"\n{len(CASES)} cases, {sum(len(e) for _, _, e in CASES)} assertions, {len(failures)} failures")
    if failures:
        print("FAILURES:", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
