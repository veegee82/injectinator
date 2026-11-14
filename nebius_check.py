"""Nebius-Verbindungsprüfung (vorbereitet, noch nicht ausgeführt).

Liest NEBIUS_API_KEY aus der Umgebung oder aus .env, ruft GET {NEBIUS_BASE_URL}/models
auf (kostet keine Tokens) und gibt NUR Anzahl und Modell-IDs aus. Der Schlüssel wird
weder ausgegeben noch protokolliert.

Start:  python3 nebius_check.py
Die Basis-URL ist per NEBIUS_BASE_URL überschreibbar; der Standardwert muss vor dem
ersten Lauf gegen die aktuelle Nebius-Dokumentation geprüft werden.
"""
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.environ.get("NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1").rstrip("/")
KEY = os.environ.get("NEBIUS_API_KEY", "")


def main() -> int:
    if not KEY:
        print("NEBIUS_API_KEY ist nicht gesetzt (weder Umgebung noch .env).")
        return 1
    print(f"Schlüssel gesetzt (Länge {len(KEY)}), Basis-URL: {BASE_URL}")
    try:
        r = requests.get(
            f"{BASE_URL}/models",
            headers={"Authorization": f"Bearer {KEY}"},
            timeout=30,
        )
    except requests.RequestException as e:
        print(f"Verbindung fehlgeschlagen: {type(e).__name__}")
        return 2
    print(f"HTTP-Status: {r.status_code}")
    if r.status_code != 200:
        return 3
    data = r.json()
    items = data.get("data", data.get("models", []))
    ids = [m.get("id", "?") for m in items if isinstance(m, dict)]
    print(f"Modelle: {len(ids)}")
    for mid in ids[:50]:
        print(f"  - {mid}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
