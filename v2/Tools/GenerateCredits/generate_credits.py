#!/usr/bin/env python3
"""Writes PhotoCredits.json: the Wikimedia Commons source, author and licence of each portrait.

Reads HOS.json for the list of heads of state, looks up the portrait each Wikipedia article
currently uses (or the term-specific Commons file GenerateAssets pins for repeat names), and
asks Commons for that file's licence metadata.

Usage: python3 generate_credits.py
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

RESOURCES = Path(__file__).resolve().parents[2] / "HO-States-US/HO-States-US/Resources"
USER_AGENT = "HO-States-CreditsGenerator/1.0 (https://github.com/molab-itp/99-HO-States)"

# Keep in sync with the `commonsFile` overrides in GenerateAssets/main.swift.
COMMONS_FILES = {
    22: "Grover Cleveland by Charles Milton Bell color change (3x4 cropped b).jpg",
    24: "StephenGroverCleveland.jpg",
    45: "Donald Trump official portrait (3x4a).jpg",
    47: "Official Presidential Portrait of President Donald J. Trump (2025).jpg",
}


def api(host, **params):
    params.update(action="query", format="json", formatversion="2", redirects="1")
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)["query"]["pages"][0]


def plain(value):
    """Commons metadata values are HTML fragments; reduce them to one line of text."""
    text = html.unescape(re.sub(r"<[^>]+>", "", str(value or "")))
    return re.sub(r"\s+", " ", text).strip()


def main():
    credits = []
    for hos in json.loads((RESOURCES / "HOS.json").read_text()):
        order = hos["order"]
        filename = COMMONS_FILES.get(order)
        if filename is None:
            page = api("en.wikipedia.org", prop="pageimages", piprop="name", titles=hos["wikipediaTitle"])
            filename = page["pageimage"].replace("_", " ")
        info = api("commons.wikimedia.org", prop="imageinfo", iiprop="extmetadata|url",
                   titles=f"File:{filename}")["imageinfo"][0]
        meta = {key: plain(value.get("value")) for key, value in info["extmetadata"].items()}
        credit = {
            "order": order,
            "name": hos["name"],
            "file": filename,
            "author": meta.get("Artist", ""),
            "license": meta.get("LicenseShortName", ""),
            "sourceURL": info["descriptionurl"],
        }
        if meta.get("LicenseUrl"):
            credit["licenseURL"] = meta["LicenseUrl"]
        credits.append(credit)
        print(f"{order:02d} {hos['name']}: {credit['license']} / {credit['author']}")
        time.sleep(0.2)  # Be polite to the Wikimedia APIs.

    out = RESOURCES / "PhotoCredits.json"
    out.write_text(json.dumps(credits, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
    print(f"Wrote {len(credits)} credits to {out}")


if __name__ == "__main__":
    main()
