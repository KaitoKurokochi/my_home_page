"""
Fetch news via Google News RSS, filter to last 24h,
build a knowledge graph with Gemini based on user interests.

Edit INTERESTS below to change what topics appear.
"""

import json
import os
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

# ── User interests (edit freely) ───────────────────────────────────────────────

INTERESTS = [
    "AI 機械学習 LLM",
    "宇宙開発 SpaceX NASA",
    "日本経済 日銀 為替",
    "プログラミング ソフトウェア開発",
    "日本政治 政策",
    "半導体 テクノロジー",
]

MAX_FETCH_PER_QUERY = 25   # articles fetched per interest query
MAX_ARTICLES_TOTAL  = 60   # articles passed to Gemini
GEMINI_MODEL        = "gemini-2.5-flash"

# ── RSS fetch ──────────────────────────────────────────────────────────────────

def google_news_url(query: str) -> str:
    return (
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode({"q": query, "hl": "ja", "gl": "JP", "ceid": "JP:ja"})
    )

def parse_pub_date(pub_str: str) -> datetime | None:
    if not pub_str:
        return None
    try:
        return parsedate_to_datetime(pub_str)
    except Exception:
        return None

def fetch_rss(query: str, cutoff: datetime) -> list[dict]:
    url = google_news_url(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            tree = ET.parse(resp)
    except Exception as e:
        print(f"  RSS error for '{query}': {e}")
        return []

    ns = {"dc": "http://purl.org/dc/elements/1.1/"}
    items = []
    for item in tree.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link  = (item.findtext("link")  or "").strip()
        desc  = (item.findtext("description") or "").strip()
        pub   = item.findtext("pubDate") or item.findtext("dc:date", namespaces=ns) or ""

        if not title or not link:
            continue

        # 日経記事のみ（Google NewsリンクはリダイレクトURLのためタイトルで判定）
        if "日本経済新聞" not in title and "nikkei" not in title.lower():
            continue

        pub_dt = parse_pub_date(pub)
        if pub_dt and pub_dt < cutoff:
            continue  # older than 24h

        items.append({
            "title": title,
            "url":   link,
            "desc":  desc[:150],
            "pub":   pub,
        })

    return items[:MAX_FETCH_PER_QUERY]

# ── Gemini: build knowledge graph ─────────────────────────────────────────────

def call_gemini_graph(all_articles: list[dict]) -> dict:
    api_key = os.environ["GEMINI_API_KEY"]
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={api_key}"
    )

    article_text = "\n".join(
        f"[{i+1}] {a['title']} | {a['desc']}"
        for i, a in enumerate(all_articles)
    )
    interests_text = "、".join(INTERESTS)

    prompt = f"""ニュースナレッジグラフを構築するキュレーターです。
ユーザーの興味: {interests_text}

以下の記事を分析して、ナレッジグラフを作成してください。

手順:
1. ユーザーの興味に関連する記事を最大40件選ぶ
2. 中心的なトピック/イベントを5〜8個特定する（例:「米中貿易摩擦」「AI規制議論」「日銀利上げ」）
3. 各記事を最も関連するトピックに接続する
4. 内容が連鎖・因果関係にある記事同士も接続する（例: 「貿易摩擦 → 円高」「円高 → 輸出企業減益」）

ノードの種類:
- type "topic": 中心的なトピック（記事ではない概念ノード）
- type "article": 個別の記事

エッジについて:
- topic→article: その記事がそのトピックに属する
- article→article: 因果・関連関係がある記事同士

【記事一覧】
{article_text}

【出力形式】JSONのみ返してください（説明不要）:
{{
  "nodes": [
    {{"id": "t1", "type": "topic", "title": "トピック名"}},
    {{"id": "a1", "type": "article", "index": 1, "headline": "25字以内の見出し", "description": "60字以内の説明"}}
  ],
  "edges": [
    {{"source": "t1", "target": "a1"}},
    {{"source": "a1", "target": "a2", "label": "影響"}}
  ]
}}"""

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3},
    }).encode()

    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.load(resp)

    raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

# ── Resolve article indices → full data ───────────────────────────────────────

def resolve_graph(graph: dict, all_articles: list[dict]) -> dict:
    nodes_out = []
    for node in graph.get("nodes", []):
        if node["type"] == "topic":
            nodes_out.append({
                "id":    node["id"],
                "type":  "topic",
                "title": node.get("title", ""),
            })
        elif node["type"] == "article":
            idx = int(node.get("index", 0)) - 1
            if 0 <= idx < len(all_articles):
                a = all_articles[idx]
                nodes_out.append({
                    "id":          node["id"],
                    "type":        "article",
                    "headline":    node.get("headline", ""),
                    "description": node.get("description", ""),
                    "url":         a["url"],
                    "pub":         a["pub"],
                })

    return {
        "nodes": nodes_out,
        "edges": graph.get("edges", []),
    }

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    print(f"Fetching articles published after {cutoff.isoformat()}")

    seen_urls = set()
    all_articles = []

    for interest in INTERESTS:
        query = f"site:nikkei.com {interest}"
        print(f"\n[{interest}]")
        items = fetch_rss(query, cutoff)
        print(f"  fetched: {len(items)} articles (within 24h)")
        for item in items:
            if item["url"] not in seen_urls:
                seen_urls.add(item["url"])
                all_articles.append(item)

    all_articles = all_articles[:MAX_ARTICLES_TOTAL]
    print(f"\nTotal unique articles: {len(all_articles)}")

    if not all_articles:
        output = {"nodes": [], "edges": [], "fetchedAt": datetime.now(timezone.utc).isoformat()}
        with open("news.json", "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print("No articles found. Saved empty news.json")
        return

    print("\nCalling Gemini to build knowledge graph...")
    try:
        graph = call_gemini_graph(all_articles)
        resolved = resolve_graph(graph, all_articles)
        print(f"  nodes: {len(resolved['nodes'])}, edges: {len(resolved['edges'])}")
    except Exception as e:
        print(f"Gemini failed: {e}")
        resolved = {"nodes": [], "edges": []}

    output = {
        "nodes":     resolved["nodes"],
        "edges":     resolved["edges"],
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("\nSaved news.json")

if __name__ == "__main__":
    main()
