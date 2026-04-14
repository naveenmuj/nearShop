#!/usr/bin/env python3
"""Prepare a local Chrome profile clone for JioMart bootstrap testing."""

from __future__ import annotations

import shutil
from pathlib import Path

source = Path.home() / r"AppData\Local\Google\Chrome\User Data"
target = Path(".jiomart-profile")

if target.exists():
    print(f"PROFILE_ALREADY_EXISTS={target}")
else:
    target.mkdir(parents=True, exist_ok=True)
    # Keep the target directory empty for a fresh Chrome profile.
    # If the user wants to seed it later, Chrome will initialize it.
    print(f"PROFILE_PREPARED={target}")
    print(f"SOURCE_HINT={source}")
