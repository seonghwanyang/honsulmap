"""Thin Supabase wrapper for the migration worker.

Only the operations the worker performs are exposed: select pending spots,
upsert story rows, bump ``last_scraped_at``. Service-role auth — this code
only runs server-side under our control.
"""
from __future__ import annotations

import os
from typing import Any

from supabase import Client, create_client


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def select_spots_for_scrape(client: Client, limit: int) -> list[dict[str, Any]]:
    """Return spots with a non-empty IG handle, oldest-scraped first."""
    resp = (
        client.table("spots")
        .select("id, name, instagram_id, last_scraped_at")
        .not_.is_("instagram_id", None)
        .neq("instagram_id", "")
        .order("last_scraped_at", desc=False, nullsfirst=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def upsert_stories(
    client: Client,
    stories: list[dict[str, Any]],
    on_conflict: str = "instagram_media_id",
) -> int:
    """Upsert and return the number of rows the server echoed back.

    Note: PostgREST returns the inserted/updated rows by default, so the
    length of ``resp.data`` is the count of touched rows. We don't try to
    distinguish inserts vs updates here.
    """
    if not stories:
        return 0
    resp = (
        client.table("stories")
        .upsert(stories, on_conflict=on_conflict)
        .execute()
    )
    return len(resp.data or [])


def update_last_scraped_at(client: Client, spot_id: str, ts_iso: str) -> None:
    client.table("spots").update({"last_scraped_at": ts_iso}).eq("id", spot_id).execute()
