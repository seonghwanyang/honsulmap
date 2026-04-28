"""HTML parser for storysaver.net result pages.

The result page is a server-rendered list of `<li class="stylestory">` items
inside `#sonucc`. Each item carries one Instagram CDN URL plus a relative
timestamp like ``"added about 10 minutes ago"``.

Extraction rules
================
1.  Locate the original IG CDN url. It is preferred from the `<a href>`
    download link (always the original mp4/jpg). Fall back to `<video src>`
    or `<img src>` only if the anchor is absent — in those cases the URL is
    proxied through ``scontentN.storysaver.net`` and unusable for the
    Next.js viewer (it expires fast and is base64 obfuscated).
2.  Skip items that lack an ``cdninstagram.com`` URL — typical for ads or
    when the entry rendered without media.
3.  ``media_type`` from the URL extension. ``.mp4`` ⇒ video, otherwise
    image.
4.  Relative timestamp text from the ``<span class="dwndsavebtn">``
    container's leading text. ``dateparser`` resolves it later.
"""
from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

_CDN_HOSTS = ("cdninstagram.com", "fbcdn.net")
_RELATIVE_TS_RE = re.compile(
    r"(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago"
    r"|just\s*now"
    r"|yesterday)",
    re.IGNORECASE,
)


def _is_cdn_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return False
    return any(host.endswith(suffix) for suffix in _CDN_HOSTS)


def _media_type_for(url: str) -> str:
    path = urlparse(url).path.lower()
    if path.endswith(".mp4") or ".mp4?" in url.lower() or "video" in path:
        return "video"
    return "image"


def _find_cdn_url(item: Tag) -> str | None:
    # 1) anchor download link — best
    for a in item.find_all("a", href=True):
        if _is_cdn_url(a["href"]):
            return a["href"]
    # 2) <video src=...> or <video><source src=...>
    for video in item.find_all("video"):
        if video.has_attr("src") and _is_cdn_url(video["src"]):
            return video["src"]
        for source in video.find_all("source", src=True):
            if _is_cdn_url(source["src"]):
                return source["src"]
    # 3) image src as last resort (rare on storysaver — usually proxied)
    for img in item.find_all("img", src=True):
        if _is_cdn_url(img["src"]):
            return img["src"]
    return None


def _find_thumbnail_url(item: Tag, primary_url: str) -> str | None:
    """Pick a usable thumbnail URL — preference order:
    1. ``<video poster="...">`` (set on video items by storysaver).
    2. Any ``<img>`` whose ``src`` is a real ``cdninstagram.com`` URL.
    3. The first proxied storysaver ``<img>`` (still usable as a poster
       image even though it expires fast).
    """
    for video in item.find_all("video"):
        poster = video.get("poster")
        if poster and poster != primary_url:
            return poster
    for img in item.find_all("img", src=True):
        src = img["src"]
        if src == primary_url:
            continue
        if _is_cdn_url(src):
            return src
    img = item.find("img", src=True)
    if img and img["src"] != primary_url:
        return img["src"]
    return None


def _find_relative_ts(item: Tag) -> str | None:
    text = item.get_text(" ", strip=True)
    m = _RELATIVE_TS_RE.search(text)
    return m.group(0) if m else None


def extract_stories(html: str) -> list[dict[str, str | None]]:
    """Parse storysaver result HTML into normalized story records."""
    soup = BeautifulSoup(html, "lxml")
    container = soup.select_one("#sonucc") or soup
    items: Iterable[Tag] = container.select("li.stylestory")

    out: list[dict[str, str | None]] = []
    for item in items:
        cdn_url = _find_cdn_url(item)
        if not cdn_url:
            continue
        media_type = _media_type_for(cdn_url)
        thumb = _find_thumbnail_url(item, cdn_url)
        # for videos, prefer a CDN-hosted poster URL
        if media_type == "video" and thumb and not _is_cdn_url(thumb):
            # storysaver proxy is fine for poster — keep as-is
            pass
        out.append(
            {
                "media_url": cdn_url,
                "media_type": media_type,
                "thumbnail_url": thumb,
                "posted_relative": _find_relative_ts(item),
            }
        )
    return out
