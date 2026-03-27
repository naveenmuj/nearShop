from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from pathlib import Path

from app.config import get_settings
from app.ranking.service import (
    get_ranking_profile,
    get_surface_profile_overrides,
    get_surface_experiments,
    save_runtime_profile_overrides,
    save_runtime_experiments,
)

EDITABLE_SURFACES = {"unified_search", "ai_recommendations", "nearby_deals", "home_feed"}
settings = get_settings()


def _history_file() -> Path:
    return Path(settings.RANKING_HISTORY_FILE)


def get_ranking_history(limit: int = 50) -> list[dict[str, Any]]:
    path = _history_file()
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    items = payload.get("events") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return []
    return list(reversed(items[-limit:]))


def append_ranking_history(event_type: str, payload: dict[str, Any]) -> None:
    path = _history_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        current = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"events": []}
    except (OSError, json.JSONDecodeError):
        current = {"events": []}
    events = current.get("events")
    if not isinstance(events, list):
        events = []
    events.append(
        {
            "event_type": event_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
    )
    path.write_text(json.dumps({"events": events[-250:]}, indent=2), encoding="utf-8")


def _normalize_experiment_variants(variants: list[dict[str, float]] | None) -> list[dict[str, float]]:
    if not variants:
        raise ValueError("At least two variants are required")

    normalized: list[dict[str, float]] = []
    seen_profiles: set[str] = set()
    for item in variants:
        profile_id = item.get("profile_id")
        weight = item.get("weight")
        if not profile_id:
            raise ValueError("Variant profile_id is required")
        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError("Variant weight must be greater than zero")
        resolved_profile_id = get_ranking_profile(profile_id).id
        if resolved_profile_id in seen_profiles:
            raise ValueError("Experiment variants must use distinct profiles")
        seen_profiles.add(resolved_profile_id)
        normalized.append(
            {
                "profile_id": resolved_profile_id,
                "weight": float(weight),
            }
        )

    if len(normalized) < 2:
        raise ValueError("At least two distinct variants are required")
    return normalized


def get_ranking_config() -> dict[str, Any]:
    return {
        "active_profile": {
            "id": get_ranking_profile().id,
            "label": get_ranking_profile().label,
        },
        "surface_profiles": get_surface_profile_overrides(),
        "surface_experiments": get_surface_experiments(),
        "history": get_ranking_history(),
        "editable_surfaces": sorted(EDITABLE_SURFACES),
    }


def update_ranking_surface_profile(surface: str, profile_id: str | None) -> dict[str, Any]:
    if surface not in EDITABLE_SURFACES:
        raise ValueError("Surface is not editable")

    current = {
        key: value["id"]
        for key, value in get_surface_profile_overrides().items()
        if key in EDITABLE_SURFACES and value.get("overridden")
    }

    if profile_id:
        current[surface] = get_ranking_profile(profile_id).id
    else:
        current.pop(surface, None)

    save_runtime_profile_overrides(current)
    append_ranking_history(
        "surface_profile_updated",
        {
            "surface": surface,
            "profile_id": current.get(surface),
        },
    )
    return get_ranking_config()


def update_ranking_experiment(surface: str, experiment_id: str | None, variants: list[dict[str, float]] | None) -> dict[str, Any]:
    if surface not in EDITABLE_SURFACES:
        raise ValueError("Surface is not editable")

    current = {
        key: {
            "experiment_id": value["experiment_id"],
            "variants": [
                {
                    "profile_id": item["profile_id"],
                    "weight": item["weight"],
                }
                for item in value["variants"]
            ],
        }
        for key, value in get_surface_experiments().items()
        if key in EDITABLE_SURFACES
    }

    if experiment_id and variants:
        current[surface] = {
            "experiment_id": experiment_id.strip(),
            "variants": _normalize_experiment_variants(variants),
        }
        if not current[surface]["experiment_id"]:
            raise ValueError("experiment_id is required")
    else:
        current.pop(surface, None)

    save_runtime_experiments(current)
    append_ranking_history(
        "surface_experiment_updated" if experiment_id and variants else "surface_experiment_cleared",
        {
            "surface": surface,
            "experiment_id": experiment_id,
            "variants": current.get(surface, {}).get("variants", []),
        },
    )
    return get_ranking_config()


def promote_ranking_experiment_winner(surface: str, experiment_id: str, winner_profile_id: str) -> dict[str, Any]:
    if surface not in EDITABLE_SURFACES:
        raise ValueError("Surface is not editable")

    experiments = {
        key: {
            "experiment_id": value["experiment_id"],
            "variants": [
                {
                    "profile_id": item["profile_id"],
                    "weight": item["weight"],
                }
                for item in value["variants"]
            ],
        }
        for key, value in get_surface_experiments().items()
        if key in EDITABLE_SURFACES
    }
    current = experiments.get(surface)
    if not current or current["experiment_id"] != experiment_id:
        raise ValueError("Experiment not found for surface")

    allowed_profiles = {item["profile_id"] for item in current["variants"]}
    resolved_profile_id = get_ranking_profile(winner_profile_id).id
    if resolved_profile_id not in allowed_profiles:
        raise ValueError("Winner profile is not part of the experiment")

    profile_overrides = {
        key: value["id"]
        for key, value in get_surface_profile_overrides().items()
        if key in EDITABLE_SURFACES and value.get("overridden")
    }
    profile_overrides[surface] = resolved_profile_id
    save_runtime_profile_overrides(profile_overrides)

    experiments.pop(surface, None)
    save_runtime_experiments(experiments)
    append_ranking_history(
        "surface_experiment_promoted",
        {
            "surface": surface,
            "experiment_id": experiment_id,
            "winner_profile_id": resolved_profile_id,
        },
    )
    return get_ranking_config()
