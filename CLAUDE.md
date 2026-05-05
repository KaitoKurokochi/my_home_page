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

Vanilla HTML/CSS/JS single page. Only `app.js` handles tab switching; everything else is static.

| File | Role |
|------|------|
| `index.html` | Structure — tab nav + sections |
| `style.css` | Theme — dark header (`#1a1a2e`) + accent color (`#e94560`) |
| `app.js` | Maps `.tab-btn[data-tab]` buttons to `#<tab-id>` sections via class toggling |

## Adding a tab

Add a `<button data-tab="xxx">` in the nav and a `<section id="xxx">` in the body — no changes to `app.js` needed.
