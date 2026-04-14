#!/usr/bin/env python3
from pathlib import Path
import re

cats = ["groceries", "fresh", "electronics", "fashion"]
queries = [
    "/p/",
    "product",
    "listing",
    "application/ld+json",
    "__NEXT_DATA__",
    "jsonld",
    "no products",
    "sold out",
    "shop by category",
]

for cat in cats:
    p = Path("docs") / f"jiomart_{cat}_snapshot.html"
    print(f"\n=== {cat} ===")
    if not p.exists():
        print("missing snapshot")
        continue

    t = p.read_text(encoding="utf-8", errors="ignore")
    lower = t.lower()

    for q in queries:
        print(f"{q}: {q.lower() in lower}")

    links = re.findall(r'href="[^"]*/p/[^"]*"', t, flags=re.I)
    print("links_with_/p/:", len(links))

    # print tiny clue around common listing tokens for quick debugging
    for token in ["__NEXT_DATA__", "application/ld+json", "shop by category"]:
        i = lower.find(token.lower())
        if i >= 0:
            print(f"snippet_{token}:", t[max(0, i-80):i+180].replace("\n", " ")[:260])
            break
