# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Purpose

A browser start page served via GitHub Pages. Set the GitHub Pages URL as the browser's homepage URL to use it.

## Development

No build tools or package manager. Open `index.html` directly in the browser to test.

```bash
open index.html
```

## Architecture

Vanilla HTML/CSS/JS single page. Two-column layout below the top bar.

| File | Role |
|------|------|
| `index.html` | Structure — `.main-layout` splits into `.left-col` (news + sports) and `.right-col` (note) |
| `style.css` | Theme + two-column flex layout |
| `app.js` | Groups/shortcuts, weather, search suggestions, Claude bar; calls `initNews()` on load |

## Layout

```
[ top-bar: search | claude | weather ]
[ groups section ]
[ main-layout                         ]
[ left-col            | right-col     ]
[ #news               | #note         ]
[ #sports             |               ]
```
