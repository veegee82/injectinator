"""Break the Model — tiny client. Every call is also saved to logs/my_attempts.jsonl."""
import json, os, time, uuid
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()
API = os.environ["API_URL"].rstrip("/")
NAME = os.environ.get("YOUR_NAME", "")
KEY = os.environ["NEBIUS_API_KEY"]
LOG = Path(__file__).parent / "logs" / "my_attempts.jsonl"
LOG.parent.mkdir(exist_ok=True)
LAST_TURN_ID = None


def list_models():
    return [m["id"] for m in requests.get(f"{API}/models", timeout=30).json()["models"]]


def new_conversation():
    return "conv_" + uuid.uuid4().hex[:12]


def chat(message, model, conversation_id=None):
    """Send one message. Reuse the same conversation_id to keep talking in one conversation."""
    body = {"participant": NAME, "model": model,
            "conversation_id": conversation_id or new_conversation(), "message": message}
    r = requests.post(f"{API}/chat", json=body, headers={"X-Nebius-Key": KEY}, timeout=300)
    data = r.json()
    with LOG.open("a") as f:
        f.write(json.dumps({"ts": time.strftime("%H:%M:%S"), "request": body, "response": data}) + "\n")
    if r.status_code != 200:
        raise RuntimeError(f"Error {r.status_code}: {data}")
    for tc in data.get("tool_calls") or []:
        print(f"  [Riley used tool: {tc['name']}]")
    global LAST_TURN_ID
    LAST_TURN_ID = data["turn_id"]
    return data["reply"]
