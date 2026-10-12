"""Refresh the public talk counts through zeta's ordinary creator page.

Run in GitHub Actions, or install Playwright/Chromium and run locally.
No login, private API, or hidden application state is used.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CREATOR = "https://zeta-ai.io/ja/creators/bdab83f9-595a-4374-bb7b-497a5a64174d/profile"


def parse_count(label: str) -> int:
    match = re.fullmatch(r"(\d+(?:\.\d+)?)(万|億)?", label.strip().replace(",", ""))
    if not match:
        raise ValueError(f"Unexpected public talk count: {label!r}")
    return round(float(match[1]) * {None: 1, "万": 10_000, "億": 100_000_000}[match[2]])


def targets() -> dict[str, str]:
    text = (ROOT / "assets/content.js").read_text(encoding="utf-8").strip()
    prefix = "window.ARCHIVE = "
    if not text.startswith(prefix):
        raise ValueError("Unexpected archive data format")
    archive = json.loads(text[len(prefix):].rstrip(";"))
    return {
        w["id"]: d["url"]
        for w in archive["works"] if w.get("visible") is not False
        for d in w.get("destinations", [])
        if d["name"] == "zeta" and d["status"] == "published"
    }


def build_snapshot(rows: list[dict], urls: dict[str, str], updated_at: str) -> dict:
    found = {}
    for order, row in enumerate(rows):
        url, label = row["url"], row["label"].strip()
        if url not in urls.values() or url in found:
            continue
        found[url] = {
            "count": parse_count(label), "label": label,
            "approximate": bool(re.search(r"[万億]", label)),
            "sourceOrder": order, "sourceUrl": url,
        }
    missing = [work_id for work_id, url in urls.items() if url not in found]
    if missing:
        raise ValueError("Incomplete collection; previous counts preserved: " + ", ".join(missing))
    return {
        "schemaVersion": 1, "platform": "zeta", "sourceUrl": CREATOR,
        "updatedAt": updated_at,
        "works": {work_id: found[url] for work_id, url in urls.items()},
    }


def collect(urls: dict[str, str]) -> list[dict]:
    # Lazy import allows offline fixture checks without installing a browser.
    from playwright.sync_api import sync_playwright

    rows = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(locale="ja-JP", viewport={"width": 1365, "height": 936})
        page = context.new_page()
        response = page.goto(CREATOR, wait_until="domcontentloaded", timeout=60_000)
        if response and response.status >= 400:
            raise RuntimeError(f"zeta returned HTTP {response.status}; no update made")
        page.locator('main a[href*="/plots/"] img').first.wait_for(timeout=45_000)
        page.mouse.move(680, 650)
        for _ in range(50):
            visible = page.locator("main").inner_text()
            if re.search(r"verify you are human|checking your browser|access denied|unusual traffic", visible, re.I):
                raise RuntimeError("zeta requested verification; no update made")
            # Read rendered card links only. The list is virtualized, so retain
            # each observed card before scrolling to load the next ones.
            cards = page.locator('main a[href*="/plots/"]').evaluate_all(
                "links => links.filter(a => a.querySelector('img'))"
                ".map(a => ({url:a.href,label:a.innerText}))"
            )
            for card in cards:
                if card["url"] in urls.values():
                    parse_count(card["label"])
                    rows.setdefault(card["url"], card)
            if set(urls.values()).issubset(rows):
                break
            page.mouse.wheel(0, 650)
            page.wait_for_timeout(1200)
        browser.close()
    return list(rows.values())


def write_snapshot(snapshot: dict) -> None:
    text = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    # Validate every expected work before either public file is replaced.
    json_path, script_path = ROOT / "assets/zeta-stats.json", ROOT / "assets/zeta-stats.js"
    json_tmp, script_tmp = json_path.with_suffix(".json.tmp"), script_path.with_suffix(".js.tmp")
    json_tmp.write_text(text, encoding="utf-8")
    script_tmp.write_text("window.ZETA_STATS = " + text.rstrip() + ";\n", encoding="utf-8")
    json_tmp.replace(json_path)
    script_tmp.replace(script_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, help="Check saved public observations without network or file changes")
    args = parser.parse_args()
    urls = targets()
    if args.fixture:
        source = json.loads(args.fixture.read_text(encoding="utf-8"))
        result = build_snapshot(source["rows"], urls, source["updatedAt"])
        print(f"Validated {len(result['works'])} public talk counts; no files changed")
        return
    rows = collect(urls)
    result = build_snapshot(rows, urls, datetime.now(timezone.utc).isoformat())
    write_snapshot(result)
    print(f"Updated {len(result['works'])} public talk counts")


if __name__ == "__main__":
    main()
