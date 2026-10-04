"""
Standalone connectivity check for Databricks Foundation Model APIs.

Not the criticality-scoring endpoint itself — just answers two questions
before any microservice code is written:
  1. Does this workspace's PAT actually have access to any serving endpoints?
     (Free Edition workspaces have been reported to hit PERMISSION_DENIED on
     pay-per-token Foundation Model endpoints until Databricks enables it.)
  2. Can we get a real chat completion back from the candidate model?

Run: source .venv/bin/activate && python test_databricks_connection.py
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
DATABRICKS_TOKEN = os.environ.get("DATABRICKS_TOKEN", "")
DATABRICKS_MODEL = os.environ.get("DATABRICKS_MODEL", "databricks-meta-llama-3-3-70b-instruct")

if not DATABRICKS_HOST or not DATABRICKS_TOKEN or DATABRICKS_HOST.startswith("https://your-workspace"):
    print("Missing or placeholder DATABRICKS_HOST / DATABRICKS_TOKEN.")
    print("Copy .env.example to .env and fill in real values first.")
    sys.exit(1)


def list_serving_endpoints():
    import requests

    url = f"{DATABRICKS_HOST}/api/2.0/serving-endpoints"
    resp = requests.get(url, headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}"}, timeout=30)
    print(f"GET {url} -> {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text[:1000])
        return []
    names = [e["name"] for e in resp.json().get("endpoints", [])]
    print(f"Endpoints visible to this token ({len(names)}):")
    for n in names:
        print(f"  - {n}")
    return names


def test_chat_completion():
    from openai import OpenAI

    client = OpenAI(api_key=DATABRICKS_TOKEN, base_url=f"{DATABRICKS_HOST}/serving-endpoints")

    print(f"\nSending test chat completion to model='{DATABRICKS_MODEL}'...")
    response = client.chat.completions.create(
        model=DATABRICKS_MODEL,
        messages=[
            {"role": "user", "content": "Reply with exactly one word: OK"},
        ],
        max_tokens=10,
    )
    print("Response object received. Content:")
    print(repr(response.choices[0].message.content))


if __name__ == "__main__":
    print("=== Step 1: list serving endpoints visible to this PAT ===")
    try:
        list_serving_endpoints()
    except Exception as e:
        print(f"Endpoint listing failed (non-fatal, continuing): {e}")

    print("\n=== Step 2: test chat completion against candidate model ===")
    try:
        test_chat_completion()
        print("\nSUCCESS: Databricks Foundation Model API call worked end-to-end.")
    except Exception as e:
        print(f"\nFAILED: {e}")
        print(
            "\nIf this is a 403/PERMISSION_DENIED, Free Edition workspaces have been "
            "reported to need Databricks support to enable pay-per-token Foundation "
            "Model endpoints. Check the endpoint list above for what IS available, "
            "and try the AI Playground in the workspace UI to cross-check."
        )
        sys.exit(1)
