# 設計書 - mermaid-error-display

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  └─ src/components/ContentView/MarkdownPreview.tsx
       └─ useEffect: Mermaid レンダリング処理（既存）
            ├─ try : mermaid.render(id, code) → SVG 置換（既存）
            └─ catch: エラーパネル DOM 置換 ← 今回の変更
```

Rust バックエンド側の変更はなし。Tauri IPC・PTY・ファイル監視には影響しない。

### 影響範囲

- **フロントエンド**:
  - `src/components/ContentView/MarkdownPreview.tsx`
  - `src/index.css`（エラーパネルのスタイルを追加する場合）
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

`MarkdownPreview.tsx` 内、Mermaid レンダリング `useEffect` の catch 句が現在は無処理。これを

1. `mermaid.render()` の reject 値からエラーメッセージを取得
2. 元の `<pre>` を `.mermaid-error` パネルに置き換え（HTML エスケープ済みのメッセージ + 折りたたみで原文コードを表示）
3. Mermaid が失敗時に DOM 末尾へ残す一時要素を掃除

の流れに変更する。

### 詳細

1. `mermaid.render()` を `try/catch` で囲っている既存処理に、`catch (err)` で `err` を受ける
2. `err instanceof Error ? err.message : String(err)` でメッセージ文字列を取り出す
3. ローカルヘルパで HTML エスケープ（`&` `<` `>` `"` `'` の 5 文字）を行う
4. 元の `<pre>`（または `code` 単体）を `<div class="mermaid-diagram mermaid-error" role="alert">…</div>` に `outerHTML` で置換
5. `document.getElementById(id)?.remove()` と `document.querySelector('#d' + id)?.remove()` で Mermaid の一時要素を掃除
6. スタイルは `src/index.css` に `.mermaid-error` ルールを追加し、既存テーマ変数（`--color-bg-elevated`, `--color-border`, `--color-text-primary`, `--color-text-muted`, ダーク時の差分は `--color-bg-base` 等）を利用

### 設計の要点

- 例外を握りつぶさない：エラーメッセージ自体はユーザーに見えるが、`useEffect` から再 throw はしない（既存ファイルの他コードブロックのレンダリングを止めないため）
- DOM 直接操作：既存の Mermaid レンダリング処理が `outerHTML` での置換をしているので、同じスタイルで揃える（React の dangerouslySetInnerHTML で生成された HTML を後から書き換える流れ）
- スコープ最小化：catch 句に閉じた変更とし、既存の正常系コードパスには手を入れない

## データ構造

### 型定義（TypeScript）

新規型は不要。catch 句の中で受け取る `err: unknown` のみ。

```typescript
// 内部ヘルパ（モジュールスコープに切り出し可）
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}
```

### 型定義（Rust）

該当なし。

## API設計

### Tauriコマンド

変更なし。

### Tauriイベント

変更なし。

## UI設計

### UIライブラリ

新規追加なし。`@radix-ui/*` や `lucide-react` への依存も不要。

### カラーパレット

`src/index.css` で定義済みの CSS カスタムプロパティを使用する：

- 背景: `--color-bg-elevated`
- ボーダー: `--color-border`（赤系のアクセントが必要なら `--color-error` がある場合は流用、無ければ専用変数を 1 つだけ追加）
- 見出しテキスト: `--color-text-primary`
- 本文テキスト: `--color-text-muted`

> ※ `--color-error` のような専用カラー変数の有無は実装時に `src/index.css` を確認し、無い場合は新規導入の可否を相談する。

### 画面構成

エラーパネルの DOM 構造（catch 句から生成）：

```html
<div class="mermaid-diagram mermaid-error" role="alert">
  <div class="mermaid-error-title">Mermaid 構文エラー</div>
  <pre class="mermaid-error-message">{エスケープ済みエラーメッセージ}</pre>
  <details class="mermaid-error-source">
    <summary>元のコード</summary>
    <pre><code>{エスケープ済み入力コード}</code></pre>
  </details>
</div>
```

レイアウトの方針：

- パネル全体を `border-left: 3px solid` で警告色を付け、視線誘導する
- `<pre>` は `white-space: pre-wrap; word-break: break-word;` で長文を折り返す
- ライト/ダークどちらでも読めることを実機（`npx tauri dev`）で確認する

### コンポーネント構成

`MarkdownPreview` 内の DOM 操作で完結。新規 React コンポーネントは作らない。理由：既存処理が `useEffect` 内で `outerHTML` 置換しているため、ここだけ React で管理しようとするとレンダリング責務が二重化する。

## 状態管理

### Zustandストア変更

なし。

## テストコード

### Reactコンポーネントテスト例

`MarkdownPreview` は Mermaid のダイナミック import を介すため、Vitest 単体テストでは Mermaid の挙動を完全には再現しにくい。テスト方針：

- 軽量な単体テストとして `escapeHtml` のような純粋ヘルパだけを切り出して検証する
- メインの確認は `testing.md` の手動テスト（構文エラーを含む `.md` ファイルを開く）に委ねる

```typescript
import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../../src/components/ContentView/MarkdownPreview' // 切り出した場合

describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    expect(escapeHtml('<a>&"\'')).toBe('&lt;a&gt;&amp;&quot;&#39;')
  })
})
```

> `escapeHtml` を export する手間が許容できない場合、このテストは省略可。

### Rustテスト例

該当なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| エラー表示は DOM 直接操作で行い、React コンポーネント化しない | 既存の Mermaid レンダリング処理が `outerHTML` 置換で完結しているため、整合性を保ち最小変更に収める | Mermaid 用の React コンポーネントを新設して `dangerouslySetInnerHTML` を React 側で管理する案。将来的に Mermaid 周りを増やすなら検討余地あり |
| 元コードはデフォルト折りたたみ（`<details>`）で表示 | 長い Mermaid だとプレビューが圧迫されるため、エラーメッセージを優先して見せる | 常時展開、トグルボタン、別タブ表示 |
| エラーメッセージは Mermaid 原文（英語）をそのまま表示 | 文言の翻訳テーブルを保守するコストが高く、原文の方が検索性が高い | i18n 対応した独自メッセージにラップ |
| 一時要素の掃除は `#<id>` と `#d<id>` のみ | 現行 Mermaid バージョンで観測されるパターンに限定し、過剰なクエリで他要素に副作用を与えない | `document.querySelectorAll('[id^="d"]')` 等の広いセレクタで一括除去 |

## 未解決事項

- [ ] `src/index.css` に `--color-error` 系の変数があるか、無ければ専用色を追加するかの判断（実装着手時に確認）
- [ ] 同一プレビュー内で正常 Mermaid とエラー Mermaid が混在したときの順序保証（既存の `forEach(async)` で並行処理されているため、置換順序に依存しない実装になっているか確認）
