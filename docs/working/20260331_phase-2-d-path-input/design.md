# 設計書 - Phase 2-D: パス入力支援

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  TreeNode（Ctrl+クリック / 右クリック）
  ContextMenu（コンテキストメニュー）
  PathPalette（Ctrl+P オーバーレイ）
    ↓ usePathInsertion hook
  terminalStore.getState() → getPtyId(activeTabId)
    ↓ tauriApi.writePty(ptyId, path)
    ↓ invoke('write_pty')
Tauri IPC
    ↓
Rust Backend (src-tauri/src/commands/pty.rs)
    ↓ write to PTY stdin
ターミナル（xterm.js）
```

### 影響範囲

- **フロントエンド**: TreeNode, appStore, terminalStore（読み取りのみ）
- **バックエンド（Rust）**: 既存の `write_pty` コマンドを流用。新規 Rust 実装は不要

## 実装方針

### 概要

パス挿入の核心は「アクティブターミナルの PTY に文字列を書き込む」だけ。既存の `tauriApi.writePty` をそのまま使用できるため、フロントエンドのみの実装となる。

### 詳細

1. **アクティブターミナルの特定**: `terminalStore` から、アクティブメインレイアウトのペイン・タブを取得し、`ptyId` を得る
2. **パス文字列の生成**: `appStore.pathFormat` に応じて絶対パスまたはプロジェクトルートからの相対パスを生成
3. **PTY への書き込み**: `tauriApi.writePty(ptyId, formattedPath + ' ')` で挿入（末尾スペースで次の入力と区切る）
4. **複数ファイル**: スペース区切りで連結してから1回の `writePty` 呼び出し

### アクティブターミナルの特定ロジック

```
appStore.activeMainTab === 'terminal' の場合:
  mainLayout === 'split':
    terminalStore.primary（focusedPane は contentStore のみ管理のため、primary を優先）
  else:
    terminalStore.primary

appStore.activeMainTab === 'content' の場合:
  contentStore.focusedPane に対応する terminalStore pane
  → ただし content 表示中でも terminal の PTY は生きているので挿入可能
```

実装を単純にするため、**常に `terminalStore.primary.activeTabId` の `ptyId` を使用**する方針とする。スプリット時はアクティブな方を判断する拡張を将来行える。

## データ構造

### 型定義（TypeScript）

```typescript
// appStore に追加
type PathFormat = 'relative' | 'absolute'

// appStore の状態追加
interface AppState {
  // ...既存フィールド
  pathFormat: PathFormat
  selectedFiles: string[]  // 複数選択中のファイルパス

  setPathFormat: (format: PathFormat) => void
  toggleFileSelection: (path: string) => void
  clearFileSelection: () => void
}
```

```typescript
// usePathInsertion hook
interface UsePathInsertionReturn {
  insertPath: (filePath: string | string[]) => void
}

// PathPalette の候補アイテム
interface PathItem {
  path: string       // 絶対パス
  label: string      // 表示用ラベル（ファイル名）
  relativePath: string  // プロジェクトルートからの相対パス
}
```

## UI 設計

### UI ライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-context-menu` | 右クリックコンテキストメニュー | アクセシビリティ属性自動付与 |
| `@radix-ui/react-dialog` | PathPalette モーダルオーバーレイ | Esc で閉じる動作が標準提供 |
| `lucide-react` | アイコン（Search, FilePlus など） | tree-shaking 対応 |

### カラーパレット

既存の CSS カスタムプロパティを使用：
- `--color-bg-elevated` — PathPalette・ContextMenu の背景
- `--color-border` — 境界線
- `--color-text-primary` / `--color-text-muted` — テキスト
- `--color-accent` — 選択中の候補ハイライト

### 画面構成

#### PathPalette（Ctrl+P）

```
┌─────────────────────────────────────────┐
│ 🔍 [ファイルを検索...              ]      │  ← 入力フィールド（自動フォーカス）
├─────────────────────────────────────────┤
│ 📄 src/components/TreePanel/TreeNode.tsx │  ← 候補一覧（上下キーで選択）
│ 📄 src/stores/appStore.ts               │  ← Enter / クリックで挿入
│ 📄 docs/working/...                     │
│  ...（最大100件）                        │
└─────────────────────────────────────────┘
```

#### コンテキストメニュー（右クリック）

```
┌───────────────────────────────┐
│ パスをターミナルに挿入          │
│ ─────────────────────────     │  ← 将来の拡張用セパレーター
│ （Phase 2-E: ファイル操作）    │
└───────────────────────────────┘
```

### コンポーネント構成

```
App.tsx
  └── PathPalette（グローバル配置、isOpen で表示制御）
      ├── Dialog.Root / Dialog.Content（Radix UI）
      ├── SearchInput
      └── CandidateList
            └── CandidateItem × N

TreePanel.tsx
  └── TreeNode.tsx
        └── ContextMenu.Root（Radix UI, 右クリックで表示）
              └── ContextMenu.Item「パスをターミナルに挿入」
```

## 状態管理

### Zustand ストア変更

```typescript
// appStore.ts への追加
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ...既存
      pathFormat: 'relative' as PathFormat,
      selectedFiles: [] as string[],

      setPathFormat: (format) => set({ pathFormat: format }),

      toggleFileSelection: (path) =>
        set((state) => ({
          selectedFiles: state.selectedFiles.includes(path)
            ? state.selectedFiles.filter((p) => p !== path)
            : [...state.selectedFiles, path],
        })),

      clearFileSelection: () => set({ selectedFiles: [] }),
    }),
    {
      name: 'spec-prompt-app-store',
      partialize: (state) => ({
        projectRoot: state.projectRoot,
        activeMainTab: state.activeMainTab,
        mainLayout: state.mainLayout,
        expandedDirs: state.expandedDirs,
        pathFormat: state.pathFormat,
        // selectedFiles は永続化しない
      }),
    }
  )
)
```

### usePathInsertion フック

```typescript
// src/hooks/usePathInsertion.ts
export function usePathInsertion() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const pathFormat = useAppStore((s) => s.pathFormat)

  const insertPath = useCallback(
    (filePath: string | string[]) => {
      const paths = Array.isArray(filePath) ? filePath : [filePath]

      const formatted = paths.map((p) => {
        if (pathFormat === 'relative' && projectRoot) {
          return p.startsWith(projectRoot)
            ? p.slice(projectRoot.length + 1)
            : p
        }
        return p
      })

      const text = formatted.join(' ') + ' '

      // アクティブターミナルの ptyId を取得
      const { primary } = useTerminalStore.getState()
      const activeTab = primary.tabs.find((t) => t.id === primary.activeTabId)
      if (activeTab?.ptyId) {
        tauriApi.writePty(activeTab.ptyId, text).catch(console.error)
      }
    },
    [projectRoot, pathFormat]
  )

  return { insertPath }
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| アクティブターミナルは常に `primary` | 実装をシンプルに保つ。focusedPane 連動は将来拡張で対応 | contentStore.focusedPane と連動する複雑なロジック |
| fuzzy 検索はフロントエンドのみ | ファイルリストは `fileTree` に既にある。Rust コマンド追加不要 | Rust 側で ripgrep 等を使う全ファイル検索 |
| Radix UI ContextMenu | アクセシビリティ属性・キーボード操作が標準提供。既に依存済み | 自前実装 |
| PathPalette は `fileTree` の平坦化リストを使用 | 展開済みノードのみ対象で十分。追加の read_dir 不要 | 全ファイル再帰取得（遅い） |
| 挿入後に末尾スペース追加 | 次の引数入力と自然に区切られる | 末尾なし（ユーザーが手動でスペースを押す必要がある） |

## 未解決事項

- [ ] ターミナル分割時（primary/secondary 両方が表示中）にどちらに挿入するか決定が必要
- [ ] PathPalette の fuzzy マッチアルゴリズムの選定（簡易部分一致 or ライブラリ）
