"""Smoke test for the storysaver client.

No DB writes -- just runs the full scrape pipeline against one handle and
prints the parsed records. Intended for manual verification:

    worker_venv\\Scripts\\python.exe worker\\test_smoke.py
    worker_venv\\Scripts\\python.exe worker\\test_smoke.py chae_jeju
"""
from __future__ import annotations

import json
import sys
import time

# Allow ``python worker/test_smoke.py`` from repo root *and*
# ``python -m worker.test_smoke``.
if __package__ in (None, ""):
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worker.storysaver_client import fetch_stories  # noqa: E402


def main() -> int:
    handle = sys.argv[1] if len(sys.argv) > 1 else "sosu.jeju"
    print(f"[smoke] fetching @{handle} via storysaver.net")
    t0 = time.time()
    try:
        records = fetch_stories(handle)
    except Exception as exc:
        print(f"[smoke] FAILED {type(exc).__name__}: {exc}")
        return 1
    dur = time.time() - t0
    print(f"[smoke] returned {len(records)} records in {dur:.1f}s")
    for i, r in enumerate(records[:5]):
        print(f"  [{i}] {json.dumps(r, ensure_ascii=False)[:240]}")
    if len(records) == 0:
        print("[smoke] WARNING -- no records. Try another handle (e.g. chae_jeju).")
    return 0 if records else 1


if __name__ == "__main__":
    sys.exit(main())
