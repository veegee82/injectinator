"""Chat with Riley:  python3 chat.py
Type your message and press Enter. Commands:  /new  (fresh conversation)   /switch  (change model)   /quit
"""
import sys
try:
    import btm
    from btm import chat, new_conversation
except KeyError:
    sys.exit("Run setup first:  python3 setup.py")

MODELS = [
    ("Qwen/Qwen3-30B-A3B-Instruct-2507", "small (easiest)"),
    ("openai/gpt-oss-120b", "medium"),
    ("Qwen/Qwen3-235B-A22B-Instruct-2507", "large"),
    ("deepseek-ai/DeepSeek-V4-Pro-0813", "very large (hardest)"),
]


def pick(prompt, n, default):
    while True:
        a = input(f"{prompt} [{default}]: ").strip() or str(default)
        if a.isdigit() and 1 <= int(a) <= n:
            return int(a)
        print(f"  Type a number from 1 to {n}.")


def choose():
    print("\nModels:")
    for i, (m, d) in enumerate(MODELS, 1):
        print(f"  {i}. {m}  — {d}")
    model = MODELS[pick("Pick a model", len(MODELS), 1) - 1][0]
    print(f"\n--- New conversation with {model}. Type /new, /switch or /quit any time. ---\n")
    return model, new_conversation()


model, conv = choose()
while True:
    try:
        msg = input("You: ").strip()
    except (EOFError, KeyboardInterrupt):
        print(); break
    if not msg:
        continue
    if msg == "/quit":
        break
    if msg == "/new":
        conv = new_conversation(); print("--- Fresh conversation (Riley forgot everything) ---\n"); continue
    if msg == "/switch":
        model, conv = choose(); continue
    print("Riley is thinking...")
    try:
        reply = chat(msg, model=model, conversation_id=conv)
        print(f"Riley: {reply}\n        (turn_id: {btm.LAST_TURN_ID})\n")
    except Exception as e:  # noqa: BLE001
        print(f"⚠️  {e}\n")
print("Bye! Found a leak? Submit the turn_id in the form (link in README).")
