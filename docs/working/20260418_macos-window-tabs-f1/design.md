# 設計書 - macos-window-tabs-f1

F1 に必要な部分のみを詳細化する。全体設計の原典は `docs/local/20260418-macOSウィンドウタブ統合/02_概要設計書.md` を参照（§0 の事前調査結果で既存実装が多数あることが判明している）。

## アーキテクチャ

### 対象コンポーネント

```
設定レイヤー
├─ src-tauri/tauri.conf.json
│    └─ app.windows[0].tabbingIdentifier = "SpecPrompt"   ← F1 追加
└─ src/lib/tauriApi.ts:openNewWindow
     └─ new WebviewWindow(label, { ..., tabbingIdentifier: "SpecPrompt" })   ← F1 追加

どちらも最終的に macOS NSWindow.tabbingIdentifier に反映され、
同 identifier を持つウィンドウが自動的にタブ統合対象になる。

※ ウィンドウタイトル更新は既に TreePanel.tsx:54 で実装済み（F1 追加作業なし）
※ ツリーヘッダの新規ウィンドウボタンは既に TreePanel.tsx:242 で実装済み
```

### 影響範囲

- **フロントエンド**: `tauriApi.ts` に 1 行追加のみ。条件によっては `TreePanel.tsx:54` のタイトル書式反転。
- **バックエンド（Rust）**: 変更なし。capabilities は既に揃っている。
- **設定**: `tauri.conf.json` の `windows[0]` に 2 キー追加。

## 実装方針

### 概要

1. **`tauri.conf.json`**: `windows[0]` に `label: "main"` と `tabbingIdentifier: "SpecPrompt"` を追加。
2. **`tauriApi.ts`**: `openNewWindow` の `WebviewWindow` options に `tabbingIdentifier: 'SpecPrompt'` を追加。
3. **E2E**: 既存のツリーヘッダボタンで 2 つ目のウィンドウを開き、Window > Merge All Windows で統合・タブ名・プロジェクト切替反映を確認。
4. **条件付きタイトル書式修正**: タブ名が `SpecPrompt` 固定で出てしまう場合のみ `TreePanel.tsx:54` を `{name} — SpecPrompt` に反転。

### 詳細

1. `src-tauri/tauri.conf.json` 編集 — `label` と `tabbingIdentifier` の 2 キー追加。
2. `src/lib/tauriApi.ts:149` の `WebviewWindow` options に `tabbingIdentifier: 'SpecPrompt'` を追加。
3. `npx tauri dev` で起動 → ツリーヘッダの「新規ウィンドウ」ボタンで 2 つ目を開く → Window > Merge All Windows。
4. タブ名を確認し、必要に応じて `TreePanel.tsx:54` の書式を反転（別コミット推奨）。

## データ構造

### 設定定義（`tauri.conf.json`）

変更前（`src-tauri/tauri.conf.json`）：
```jsonc
{
  "app": {
    "windows": [
      {
        "title": "SpecPrompt",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "devtools": true,
        "dragDropEnabled": true
      }
    ]
  }
}
```

変更後：
```jsonc
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "SpecPrompt",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "devtools": true,
        "dragDropEnabled": true,
        "tabbingIdentifier": "SpecPrompt"
      }
    ]
  }
}
```

### TypeScript 差分（`src/lib/tauriApi.ts`）

変更前（`src/lib/tauriApi.ts:144-157`）：
```typescript
openNewWindow: (projectPath?: string): void => {
  const label = `window-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const url = projectPath
    ? `index.html?project=${encodeURIComponent(projectPath)}`
    : 'index.html?new=1'
  const win = new WebviewWindow(label, {
    url,
    title: 'SpecPrompt',
    width: 1200,
    height: 800,
    resizable: true,
  })
  win.once('tauri://error', (e) => console.error('Failed to create window:', e))
},
```

変更後：
```typescript
openNewWindow: (projectPath?: string): void => {
  const label = `window-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const url = projectPath
    ? `index.html?project=${encodeURIComponent(projectPath)}`
    : 'index.html?new=1'
  const win = new WebviewWindow(label, {
    url,
    title: 'SpecPrompt',
    width: 1200,
    height: 800,
    resizable: true,
    tabbingIdentifier: 'SpecPrompt',
  })
  win.once('tauri://error', (e) => console.error('Failed to create window:', e))
},
```

### TypeScript 差分（条件付き、`src/components/TreePanel/TreePanel.tsx:54`）

**現状**：
```typescript
getCurrentWindow().setTitle(name ? `SpecPrompt — ${name}` : 'SpecPrompt').catch(console.error)
```

**E2E で「タブ名が `SpecPrompt` 固定になる」ことを確認した場合のみ**、以下に変更：
```typescript
getCurrentWindow().setTitle(name ? `${name} — SpecPrompt` : 'SpecPrompt').catch(console.error)
```

この変更は E2E 結果次第で実施／見送りを判断する。

### Rust 差分

F1 では変更なし。

## API設計

### Tauriコマンド

F1 では新規・変更なし。

### Tauriイベント

F1 では新規・変更なし。

### 使用する既存 API

| API | 呼び出し箇所 | 用途 |
|-----|-----------|------|
| `new WebviewWindow(label, options)` | `src/lib/tauriApi.ts:149` | 動的ウィンドウ生成（既存） |
| `getCurrentWindow().setTitle(title)` | `src/components/TreePanel/TreePanel.tsx:54` | タイトル・タブ名更新（既存） |

## UI設計

F1 は UI コンポーネントの追加・変更なし。OS 機能に依存。

## 状態管理

### Zustandストア変更

F1 では既存ストアの変更なし。persist キーの名前空間分離は F3 で実施。

F1 時点で 2 ウィンドウを同時起動すると `spec-prompt-app-store` 共有による状態混線の可能性はあるが、`src/lib/windowSession.ts` が projectRoot を個別管理しているため F1 の E2E では顕在化しない想定。E2E 中に異常が出たら記録し、F3 で対応する。

## テストコード

### ユニットテスト（任意）

既存 `tauriApi` テストが無い場合、F1 では OS 機能依存のため手動 E2E に任せてユニットテストを省略する。ある場合は以下の方針で追加：

```typescript
// 既存テストファイルが存在する場合のみ追加
import { describe, it, expect, vi } from 'vitest'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({ once: vi.fn() })),
}))

describe('openNewWindow', () => {
  it('tabbingIdentifier: "SpecPrompt" 付きで WebviewWindow を生成する', async () => {
    const { tauriApi } = await import('./tauriApi')
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    tauriApi.openNewWindow()
    expect(WebviewWindow).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tabbingIdentifier: 'SpecPrompt' })
    )
  })
})
```

### Rustテスト

F1 では Rust 側変更なし、追加テストなし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `tauri.conf.json` と `tauriApi.ts` の両方に `tabbingIdentifier` を設定 | Tauri v2 の `WebviewWindow` 動的生成は静的設定を継承しないため、両方に書かないと動的ウィンドウがタブ統合対象外になる | 片方のみ（却下、機能しない） |
| `useWindowTitle` フックを新設しない | `TreePanel.tsx:54` で既に同機能が実装済み。新設は重複コード化 | フック化してリファクタ（F1 のスコープ外、必要なら別 PR で） |
| `tabbingIdentifier` 値をハードコード `"SpecPrompt"` | 変更頻度がほぼゼロ、定数抽出は過剰設計 | 定数 export（将来 F2+F3 で必要になれば導入） |
| `label: "main"` を追加 | `capabilities/default.json` の `windows: ["main", "window-*"]` が "main" を前提にしているため、明示するのが安全 | label 省略（Tauri がデフォルト "main" を割り当てるはずだが、明示すべき） |
| タイトル書式反転は E2E 結果次第 | 現行書式で既に動いている可能性があり、先行変更はリスク | 先行反転（却下、E2E で正否を決める） |
| ユニットテストを必須化しない | OS 機能依存で手動 E2E が主要検証。ユニットテストは `openNewWindow` の options が正しいことの確認に限定され、コストに見合わない場合がある | 必須化（却下、柔軟に判断） |

## 未解決事項

- [ ] 既存 `tauriApi` のテストファイル有無（`src/lib/tauriApi.test.ts` 等）を実装着手時に確認。存在すればユニットテスト追加、無ければ見送り。
- [ ] タイトル書式 `SpecPrompt — {name}` がタブ名として正しく出るかの E2E 結果。
