# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

ブラウザを開いたときのホームページ（スタートページ）。GitHub Pages で公開し、ブラウザのホームページURLに設定して使う。

## Development

ビルドツール・パッケージマネージャなし。ブラウザで `index.html` を直接開けば動作確認できる。

```bash
open index.html
```

## Architecture

バニラ HTML/CSS/JS のシングルページ。タブ切り替えのみ `app.js` が担当し、それ以外はすべて静的。

- `index.html` — 構造（タブナビ + セクション）
- `style.css` — ダークヘッダー（`#1a1a2e`）＋アクセントカラー（`#e94560`）のテーマ
- `app.js` — `.tab-btn[data-tab]` と `#<tab-id>` を対応させてクラス切り替え

タブを追加するときは `index.html` に `<button data-tab="xxx">` と `<section id="xxx">` をセットで追加するだけ。`app.js` の変更は不要。

## Directory note

`my_home_page/` は同じ内容のコピーが存在する（用途未定）。メインの編集対象はルートの3ファイル。
