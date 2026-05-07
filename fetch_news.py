"""
Fetch Nikkei articles via Google News RSS, categorize with Gemini, save news.json.

Column definitions and industries are editable without touching the logic.
"""

import json
import os
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# ── Configuration ──────────────────────────────────────────────────────────────

COLUMNS = [
    {
        "id":    "morning",
        "title": "Today's Top",
        "query": "日本 主要ニュース",
        "max":   6,
    },
    {
        "id":    "tech",
        "title": "テクノロジー",
        "query": "テクノロジー OR AI OR 半導体 OR スタートアップ",
        "max":   6,
    },
    {
        "id":    "gov",
        "title": "日本政府の動き",
        "query": "日本 政府 OR 首相 OR 政策 OR 国会",
        "max":   6,
    },
    {
        "id":    "sports",
        "title": "スポーツ・ビジネス",
        "query": "スポーツビジネス OR スポーツ経済 OR アスリート ビジネス",
        "max":   6,
    },
]

MAX_FETCH_PER_COL = 20
GEMINI_MODEL      = "gemini-2.5-flash"
MEDIA_NS          = "http://search.yahoo.com/mrss/"

# ── RSS fetch ──────────────────────────────────────────────────────────────────

def google_news_url(query: str) -> str:
    return (
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode({"q": query, "hl": "ja", "gl": "JP", "ceid": "JP:ja"})
    )

def fetch_rss(query: str) -> list[dict]:
    url = google_news_url(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        tree = ET.parse(resp)

    ns = {
        "dc":    "http://purl.org/dc/elements/1.1/",
        "media": MEDIA_NS,
    }
    items = []
    for item in tree.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link  = (item.findtext("link")  or "").strip()
        desc  = (item.findtext("description") or "").strip()
        pub   = item.findtext("pubDate") or item.findtext("dc:date", namespaces=ns) or ""

        # Try to get thumbnail image from media namespace
        image = None
        for tag in ("media:content", "media:thumbnail"):
            el = item.find(tag, namespaces=ns)
            if el is not None and el.get("url"):
                image = el.get("url")
                break

        if title and link:
            items.append({
                "title": title,
                "url":   link,
                "desc":  desc[:150],
                "pub":   pub,
                "image": image,
            })
    return items[:MAX_FETCH_PER_COL]

# ── Gemini categorization ──────────────────────────────────────────────────────

def call_gemini(col: dict, articles: list[dict]) -> list[dict]:
    api_key = os.environ["GEMINI_API_KEY"]
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={api_key}"
    )

    article_text = "\n".join(
        f"[{i+1}] {a['title']} | {a['desc']}"
        for i, a in enumerate(articles)
    )

    prompt = f"""あなたは日経新聞のキュレーターです。
カテゴリ「{col['title']}」に最も関連する記事を最大{col['max']}件選び、各記事を30字以内で日本語要約してください。

【記事一覧】
{article_text}

【出力形式】JSONリストのみ返してください（説明不要）。
[
  {{"index": 1, "summary": "一言要約（30字以内）"}},
  ...
]"""

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }).encode()

    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.load(resp)

    raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    selections = json.loads(raw.strip())

    selected = []
    for s in selections:
        idx = int(s["index"]) - 1
        if 0 <= idx < len(articles):
            a = articles[idx]
            selected.append({
                "title":   a["title"],
                "summary": s["summary"],
                "url":     a["url"],
                "pub":     a["pub"],
                "image":   a["image"],
            })
    return selected

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    columns_out = []
    for col in COLUMNS:
        print(f"\n[{col['title']}]")
        try:
            articles = fetch_rss(col["query"])
            print(f"  fetched: {len(articles)} articles")
        except Exception as e:
            print(f"  RSS failed: {e}")
            columns_out.append({"id": col["id"], "title": col["title"], "articles": []})
            continue

        try:
            selected = call_gemini(col, articles)
            print(f"  selected: {len(selected)} articles")
        except Exception as e:
            print(f"  Gemini failed: {e}")
            selected = []

        columns_out.append({
            "id":       col["id"],
            "title":    col["title"],
            "articles": selected,
        })

    output = {
        "columns":   columns_out,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("\nSaved news.json")

if __name__ == "__main__":
    main()
