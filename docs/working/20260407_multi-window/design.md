# 設計書 - Phase 3-G: 複数ウィンドウ表示

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ↓ @tauri-apps/api/webviewWindow
Tauri WebviewWindow API
    ↓
新規 WebView プロセス（独立した React インスタンス）
    ↓
独立した appStore / contentStore / terminalStore
```

### 影響範囲

- **フロントエンド**:
  - `src/lib/tauriApi.ts` — `openNewWindow()` 追加
  - `src/components/TreePanel/ContextMenu.tsx` — 新規ウィンドウメニュー項目
  - `src/components/TreePanel/TreePanel.tsx` — ツールバーボタン
  - `src/components/TreePanel/TreeNode.tsx` — prop 追加
  - `src/main.tsx` — 起動時クエリパラメータ読み取り
  - `src/i18n/locales/ja.json` / `en.json` — 翻訳キー追加
- **バックエンド（Rust）**: 変更なし（WebviewWindow はフロントエンド JS API で完結）

## 実装方針

### 概要

Tauri v2 の `WebviewWindow` クラスをフロントエンド JS から直接インスタンス化することで新規ウィンドウを起動する。Rust コマンドは不要。プロジェクトパスは URL の `search` パラメータ（`?project=...`）として渡し、新規ウィンドウの `main.tsx` 起動時に読み取る。

### 詳細

1. **新規ウィンドウ起動** (`tauriApi.ts`)
   - `WebviewWindow` を `import { WebviewWindow } from '@tauri-apps/api/webviewWindow'` でインポート
   - `openNewWindow(projectPath?: string)` 関数を実装
   - ウィンドウラベルは `window-{timestamp}` で一意性を確保
   - URL は `index.html?project={encodeURIComponent(projectPath)}` で構成

2. **起動時パラメータ読み取り** (`main.tsx`)
   - `new URLSearchParams(window.location.search).get('project')` でパスを取得
   - 取得できた場合、`appStore.openProject(projectPath)` を呼び出して自動オープン
   - `useSettingsStore.getState().loadSettings()` → 言語同期は既存フローそのまま

3. **UI 追加**
   - `ContextMenu.tsx`: フォルダノードに「新規ウィンドウで開く」メニュー項目を追加（`ExternalLink` の代わりに `SquareArrowOutUpRight` アイコン）
   - `TreePanel.tsx`: ツールバーに `SquareArrowOutUpRight` アイコンボタンを追加（現在のプロジェクトを新規ウィンドウで開く）

4. **ウィンドウタイトル更新**
   - `appStore` の `projectRoot` が変わるたびに `document.title` を更新
   - `TreePanel.tsx` の `useEffect` で `appStore` の `projectRoot` を購読し、タイトルを設定

## データ構造

### 型定義（TypeScript）

```typescript
// tauriApi.ts に追加
// WebviewWindow のラベルはウィンドウごとに一意
// 例: "window-1744000000000"

// openNewWindow の引数・戻り値
// projectPath: undefined の場合は空の状態で起動
async function openNewWindow(projectPath?: string): Promise<void>
```

### URL クエリパラメータ仕様

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `project` | string (URI エンコード済みパス) | 任意 | 起動時に開くプロジェクトフォルダの絶対パス |

例: `index.html?project=%2FUsers%2Ffoo%2Fbar`

## API設計

### Tauri コマンド

今回は Rust コマンドの追加なし。`WebviewWindow` API はフロントエンドのみで完結する。

### フロントエンド API（tauriApi.ts への追加）

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

async function openNewWindow(projectPath?: string): Promise<void> {
  const label = `window-${Date.now()}`
  const url = projectPath
    ? `index.html?project=${encodeURIComponent(projectPath)}`
    : 'index.html'
  new WebviewWindow(label, {
    url,
    title: 'SpecPrompt',
    width: 1200,
    height: 800,
    resizable: true,
  })
}
```

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `lucide-react` | `SquareArrowOutUpRight` アイコン | 新規ウィンドウを示す標準的なアイコン |

### カラーパレット

既存の CSS カスタムプロパティを使用する：
- `--color-text-muted` — ボタンのデフォルト色
- `--color-text-primary` — ホバー時の色
- `--color-accent` — アクティブ色（ツールバー）

### 画面構成

**ContextMenu（フォルダノード）への追加:**
```
[パスをターミナルに挿入]
─────────────────────
[新規ファイル]
[新規フォルダ]
─────────────────────
[Finderで開く]             ← 既存
[新規ウィンドウで開く]     ← 追加（フォルダのみ）
─────────────────────
[リネーム]
[削除]
```

**TreePanel ツールバーへの追加:**
```
[プロジェクト名 ▼]   [フォルダを開く]  [新規ウィンドウ（空）]  [設定]
```
- ツールバーボタンは **空ウィンドウ**を起動（`openNewWindow()` を引数なしで呼ぶ）
- 右クリックメニューの「新規ウィンドウで開く」は**そのフォルダを開いた状態**で起動（設計上の使い分け）
- tooltip: `"新規ウィンドウを開く"`（空で起動することを示す）

**ツールバーボタンとコンテキストメニューの起動挙動の違い:**

| 操作 | 起動状態 | ユースケース |
|------|---------|-------------|
| ツールバーの新規ウィンドウボタン | 空ウィンドウ | 別プロジェクトをゼロから開く |
| フォルダ右クリック → 新規ウィンドウで開く | そのフォルダを開いた状態 | サブディレクトリを別プロジェクトとして開く |

### コンポーネント構成

- `TreeContextMenu` — `onOpenNewWindow?: () => void` prop を追加
- `TreeNode` — `handleOpenNewWindow` を実装し `ContextMenu` に渡す（フォルダのみ）
- `TreePanel` — ツールバーに新規ウィンドウボタンを追加

## 状態管理

### Zustand ストア変更

`appStore.ts` に起動時の自動オープンロジックを追加する（ストアのインターフェース変更なし）:

```typescript
// main.tsx の起動フローに追加
const params = new URLSearchParams(window.location.search)
const initialProject = params.get('project')
if (initialProject) {
  useAppStore.getState().openProject(initialProject)
}
```

ウィンドウタイトル同期（TreePanel.tsx の useEffect で実装）:

```typescript
useEffect(() => {
  const name = projectRoot?.split('/').pop() ?? null
  document.title = name ? `SpecPrompt — ${name}` : 'SpecPrompt'
}, [projectRoot])
```

### i18n キー追加

`ja.json` / `en.json` に追加するキー:

```json
// tree セクションに追加
"tooltip": {
  "openProject": "プロジェクトを開く",      // 既存
  "settings": "設定",                       // 既存
  "newWindow": "新規ウィンドウで開く"        // 追加
}

// contextMenu セクションに追加
"openInNewWindow": "新規ウィンドウで開く"    // 追加
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Rust コマンドなし・フロントエンド JS のみで `WebviewWindow` を生成 | Tauri v2 は JS API で完結でき、Rust 側の変更ゼロで実装できる | Rust の `create_window` コマンドを用意する（過剰な複雑さ） |
| ウィンドウラベルに `Date.now()` を使用 | シンプルかつ重複しない | UUID（依存ライブラリ追加が必要） |
| プロジェクトパスを URL クエリパラメータで渡す | WebView 起動前に値を渡せる唯一の手段 | Tauri `emit` イベントで渡す（タイミング依存で不安定） |
| ウィンドウ間で設定（テーマ・フォント・言語）を共有する | localStorage を全ウィンドウが共有するため自然な動作 | ウィンドウごとに独立した設定（UX が複雑化） |
| ツールバーボタンは空ウィンドウ起動、右クリックはフォルダ指定起動 | 分割表示が「同一プロジェクトの複数ファイル並べ」を担うため、新規ウィンドウの主ユースケースは「別プロジェクトを開く」。ツールバーは空で起動しフォルダ選択を促す | ツールバーでも現在のプロジェクトを開く（分割機能との役割重複） |

## 未解決事項

- [x] `@tauri-apps/api` バージョンで `WebviewWindow` の import パスが異なる場合の確認 → `@tauri-apps/api v2` で `@tauri-apps/api/webviewWindow` が正しい
- [x] 開発環境での URL 確認 → `npx tauri dev` 環境では `http://localhost:1420/index.html?project=...` で動作することを確認
