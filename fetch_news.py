"""
Fetch Nikkei RSS, select interesting articles via Gemini, save news.json.

Industries to watch are defined in INDUSTRIES (editable without touching the logic).
"""

import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# ── Configuration ──────────────────────────────────────────────────────────────

INDUSTRIES = [
    "AI / 人工知能",
    "半導体・電子部品",
    "スタートアップ・ベンチャー",
    "エネルギー・脱炭素",
    "マクロ経済・金融政策",
]

NIKKEI_RSS_FEEDS = [
    ("Top",    "https://www.nikkei.com/rss/index.rss"),
    ("Tech",   "https://www.nikkei.com/rss/technology.rss"),
    ("Money",  "https://www.nikkei.com/rss/money.rss"),
]

MAX_ARTICLES_PER_FEED = 30   # articles sent to Gemini per feed
MAX_SELECTED           = 10  # articles Gemini selects in total
GEMINI_MODEL           = "gemini-1.5-flash"

# ── RSS fetch ──────────────────────────────────────────────────────────────────

def fetch_rss(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        tree = ET.parse(resp)
    ns = {"dc": "http://purl.org/dc/elements/1.1/"}
    items = []
    for item in tree.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link  = (item.findtext("link")  or "").strip()
        desc  = (item.findtext("description") or "").strip()
        pub   = item.findtext("pubDate") or item.findtext("dc:date", namespaces=ns) or ""
        if title and link:
            items.append({"title": title, "url": link, "desc": desc, "pub": pub})
    return items[:MAX_ARTICLES_PER_FEED]

# ── Gemini selection ───────────────────────────────────────────────────────────

def call_gemini(articles: list[dict]) -> list[dict]:
    api_key = os.environ["GEMINI_API_KEY"]
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={api_key}"
    )

    industry_list = "\n".join(f"- {i}" for i in INDUSTRIES)
    article_text  = "\n".join(
        f"[{i+1}] {a['title']} | {a['desc'][:120]}"
        for i, a in enumerate(articles)
    )

    prompt = f"""あなたは日経新聞の記事キュレーターです。
以下の業界に関心のある読者向けに、記事一覧から最大{MAX_SELECTED}件を選んでください。

【関心業界】
{industry_list}

【記事一覧】
{article_text}

【出力形式】選んだ記事を以下のJSONリストのみ返してください（説明不要）。
[
  {{"index": 1, "summary": "一言日本語要約（30字以内）"}},
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
    # Strip markdown code fences if present
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
            })
    return selected

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    all_articles: list[dict] = []
    for label, feed_url in NIKKEI_RSS_FEEDS:
        try:
            items = fetch_rss(feed_url)
            print(f"  {label}: {len(items)} articles")
            all_articles.extend(items)
        except Exception as e:
            print(f"  {label}: failed — {e}")

    # Deduplicate by URL
    seen, unique = set(), []
    for a in all_articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique.append(a)

    print(f"Total unique articles: {len(unique)}")

    selected = call_gemini(unique)
    print(f"Gemini selected: {len(selected)} articles")

    output = {
        "articles":  selected,
        "industries": INDUSTRIES,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("Saved news.json")

if __name__ == "__main__":
    main()
