# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Purpose

A personal browser start page served via GitHub Pages (or as a local `file://`). Set the GitHub Pages URL as the browser's homepage URL to use it.

## Development

No build tools or package manager. Open `index.html` directly in the browser to test.

```bash
open index.html
```

## Architecture

Vanilla HTML/CSS/JS single page. Two-column layout below the top bar.

### Page files (`$WORKSPACE/my_home_page/`)

| File | Role |
|------|------|
| `index.html` | Main page; `.main-layout` splits into `.left-col` (news/sports) and `.right-col` (note) |
| `style.css` | Theme + two-column flex layout |
| `app.js` | Groups/shortcuts, weather widget, search suggestions, Claude bar |
| `status.js` | Status report fetch, rendering, section collapsing, location filter |
| `note.js` | GitHub Issues-based note CRUD |
| `location_zones.js` | Nominatim reverse geocoding + keyword match for zone detection |
| `meeting_note.js` | Research Meeting note detection and display |
| `meeting_note.html` | Research Meeting note viewer page |
| `news.js` | Nikkei news feed + D3 knowledge graph |
| `sync.js` | Sync localStorage state to GitHub Gist |

### Layout

```
[ top-bar: search | claude | weather ]
[ groups section ]
[ main-layout                         ]
[ left-col            | right-col     ]
[ #news               | #note         ]
[ #sports             |               ]
```

## Supporting scripts (`$WORKSPACE/agent-scripts/`)

| File | Role |
|------|------|
| `sync_notes.py` | GitHub Issues → note.md sync; my_home_page issues get special routing (Bugs/Backlog → status_report.md, rest → note.md Temporal) |
| `flush_temporal.py` | Move Temporal section items (tagged `[Idea]`/`[Question]`/`[Memo]`) to Notes subsections, then clear Temporal |
| `assembler.py` | Build status report + update location_zones.json |
| `section_report.py` | Generate weekly report via weekly_report.toml prompt |
| `create_meeting_note.py` | Detect Research Meeting → create meeting note template |
| `fetch_news.py` | Fetch news + generate knowledge graph |
| `morning_routine.sh` | Runs once at 05:55 (6 steps including flush_temporal) |
| `main_routine.sh` | Runs every 30 min from 06:30 to 22:30 |

## Configuration (`$AGENT_DIR/my_home_page/`)

| File | Role |
|------|------|
| `config.toml` | Domain key/label, sync instructions, recurring tasks, status_report prompt |
| `page_config/location_zones.toml` | Zone definitions; run `assembler.py` after edits to regenerate `location_zones.json` |
| `page_config/weekly_report.toml` | Weekly report generation prompt (used by `section_report.py`) |
| `page_config/fetch_news.toml` | News fetch prompt (used by `fetch_news.py`) |
| `page_config/issue_sync.toml` | my_home_page issue routing prompt (used by `sync_notes.py`) |

Note: `$AGENT_DIR/my_home_page/` is the agent notes directory (`~/agent/my_home_page/`), not this repo.

## Note system

- Backend: GitHub Issues on `KaitoKurokochi/my_notes` (label: `note`)
- Token stored in localStorage as `NOTE_TOKEN`
- Labels stored in localStorage; label → domain key mapping in `sync_notes.py` `_LABEL_ALIASES`
- Roles: Memo, Todo, Idea, Want to do, Question, Done
- my_home_page issues are routed by Gemini: Bug/Backlog → status_report.md, others → note.md Temporal section

## Routines

- `morning_routine.sh` (05:55, once): Step 1 = flush_temporal.py, then calendar/tasks/domains/meeting-note/reminders
- `main_routine.sh` (06:30–22:30, every 30 min): sync_notes → assembler → section_report → fetch_news

## Version management

Branch strategy:
- `my_home_page`: `feature/*` → `develop` → (Sunday review) → `main` + tag
- `agent-scripts`: `feature/*` → (Sunday review) → `master` + tag

Versioning: semantic versioning (vMAJOR.MINOR.PATCH)
- MINOR +1: feature additions or improvements
- PATCH +1: bug fixes only

Sunday review flow (manual):
1. `git log v{current}..develop --oneline` to review changes in `my_home_page`
2. `git log v{current}..master --oneline` to review changes in `agent-scripts`
3. User approves → merge to main + new version tag + push

Current versions:
- `my_home_page`: v1.1.0
- `agent-scripts`: v1.0.0
