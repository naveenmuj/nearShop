#!/usr/bin/env python3
"""Test the OpenAI API key configured in nearshop-api/.env."""

from __future__ import annotations

import sys
from pathlib import Path

from openai import OpenAI


def load_api_key() -> str:
    env_path = Path(__file__).resolve().parent / "nearshop-api" / ".env"
    if not env_path.exists():
        raise RuntimeError(f"Missing env file: {env_path}")

    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("OPENAI_API_KEY not found in nearshop-api/.env")


def main() -> int:
    api_key = load_api_key()
    print("Testing OpenAI API key from nearshop-api/.env")
    print(f"Key detected: {bool(api_key)}")
    print(f"Key length: {len(api_key)}")

    client = OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a concise assistant."},
                {"role": "user", "content": "Reply with exactly: API test successful"},
            ],
            max_tokens=10,
            temperature=0,
        )
    except Exception as exc:
        print(f"OPENAI API ERROR: {type(exc).__name__}")
        print(str(exc))
        return 1

    result = response.choices[0].message.content or ""
    print("SUCCESS")
    print(f"Model: {response.model}")
    print(f"Response: {result}")
    print(f"Tokens used: {getattr(response.usage, 'total_tokens', 'n/a')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
