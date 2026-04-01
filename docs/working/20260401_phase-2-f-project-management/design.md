# 設計書 - Phase 2-F: プロジェクト管理

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    TreePanel（プロジェクト名クリック → ドロップダウン）
    RecentProjectsMenu（新規コンポーネント）
    appStore（recentProjects, switchProject）
    contentStore（resetAllTabs）
         ↓ invoke()
Tauri IPC
         ↓
Rust Backend
    src-tauri/src/commands/config.rs
         ↓
~/.config/spec-prompt/config.json
```

### 影響範囲

- **フロントエンド**: `TreePanel`, `appStore`, `contentStore`, 新規 `RecentProjectsMenu`
- **バックエンド（Rust）**: 新規 `config.rs`, `lib.rs`（コマンド登録）

---

## 実装方針

### 概要

Rust 側に Config Manager を実装し、設定ファイル (`~/.config/spec-prompt/config.json`) の永続化を担う。フロントエンドは起動時に `get_recent_projects` でリストを取得し、プロジェクトを開くたびに `add_recent_project` を呼んで履歴を更新する。

プロジェクト切り替えは `appStore.switchProject(path)` という単一のアクションに集約し、リセット処理を一元管理する。

### 詳細

1. **Config 構造体（Rust）**: `recent_projects: Vec<String>` と将来用フィールドを持つ。`Default` トレイトでデフォルト値を定義。
2. **Config Manager 操作**: `get_recent_projects` / `add_recent_project` の2コマンドに絞る。完全な read/write は内部で行い、フロントエンドから Config 全体を触らせない。
3. **`switchProject` アクション**: `appStore` のアクションとして実装。ツリー・選択状態のリセット → `setProjectRoot` → `contentStore.resetAllTabs()` を順に実行。
4. **RecentProjectsMenu**: Radix UI `DropdownMenu` を使用。`TreePanel` ヘッダーのプロジェクト名部分をトリガーにする。

---

## データ構造

### 型定義（TypeScript）

```typescript
// tauriApi.ts に追加
// get_recent_projects の戻り値: string[]

// appStore に追加
interface AppState {
  // ...既存フィールド...

  // Phase 2-F
  recentProjects: string[]
  setRecentProjects: (projects: string[]) => void
  switchProject: (root: string) => void  // リセット + setProjectRoot を一括実行
}
```

### 型定義（Rust）

```rust
// src-tauri/src/commands/config.rs

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub recent_projects: Vec<String>,
    // 将来: pub theme: String, pub path_format: String, etc.
}

impl Default for Config {
    fn default() -> Self {
        Self {
            recent_projects: vec![],
        }
    }
}
```

---

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `get_recent_projects` | なし | `Result<Vec<String>, String>` | 最近開いたプロジェクト一覧（最大10件・新しい順）を返す |
| `add_recent_project` | `path: String` | `Result<(), String>` | パスを先頭に追加し（重複除去・最大10件）、設定ファイルに保存 |

### Tauriイベント

なし（設定の読み書きは同期的なコマンドで完結）

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dropdown-menu` | 最近のプロジェクトドロップダウン | 既存の ContextMenu と同様のスタイル |
| `lucide-react` | `ChevronDown`, `FolderOpen`, `Clock` アイコン | tree-shaking対応 |

### カラーパレット

既存の CSS カスタムプロパティを使用：
- `--color-bg-elevated` — ドロップダウン背景
- `--color-border` — ボーダー・セパレーター
- `--color-text-primary` / `--color-text-muted` — テキスト
- `--color-accent` — ホバー・アクティブ状態

### 画面構成

TreePanel ヘッダー（変更後）:

```
┌─────────────────────────────────┐
│ [▼ spec-prompt]    [📂]         │  ← プロジェクト名をクリックでドロップダウン
└─────────────────────────────────┘
         ↓ クリック
┌────────────────────────┐
│ 最近開いたプロジェクト  │
│ ──────────────────── │
│ 📁 spec-prompt ✓      │  ← 現在のプロジェクト（チェックマーク付き）
│ 📁 my-api-project     │
│ 📁 design-docs        │
└────────────────────────┘
```

### コンポーネント構成

```
TreePanel
  └─ RecentProjectsMenu（新規）
       └─ DropdownMenu.Root（Radix UI）
            ├─ DropdownMenu.Trigger（プロジェクト名テキスト + ChevronDown）
            └─ DropdownMenu.Content
                 ├─ DropdownMenu.Label（"最近開いたプロジェクト"）
                 ├─ DropdownMenu.Separator
                 └─ DropdownMenu.Item × N（各プロジェクト）
```

---

## 状態管理

### Zustand ストア変更

#### appStore.ts

```typescript
// 追加フィールド・アクション
recentProjects: string[]
setRecentProjects: (projects: string[]) => void
switchProject: (root: string) => void

// switchProject の実装イメージ
switchProject: (root) => {
  set({
    projectRoot: root,
    fileTree: [],
    expandedDirs: new Set<string>(),
    selectedFile: null,
    selectedFiles: [],
    editingState: null,
    creatingState: null,
  })
  // contentStore のタブリセットは TreePanel 側から呼ぶ
}
```

`partialize` に `recentProjects` は含めない（config.json を正とし、localStorage には保存しない）。

#### contentStore.ts

```typescript
// 追加アクション
resetAllTabs: () => void
// 両ペインのタブをすべてクリアする
```

---

## テストコード

### Rustテスト

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_add_recent_project_deduplication() {
        // 同じパスを2回追加しても1件のみ（先頭に移動）
    }

    #[test]
    fn test_add_recent_project_max_10() {
        // 11件追加すると最古が切り捨てられ10件になる
    }

    #[test]
    fn test_config_default_on_missing_file() {
        // 存在しないパスからロードするとデフォルト値が返る
    }
}
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `get_recent_projects` + `add_recent_project` の2コマンド構成 | フロントエンドに Config 全体を渡すと将来の構造変更時の後方互換が難しい | `load_config` / `save_config` で全体を扱う |
| ターミナルセッションはリセットしない | セッションを維持したままプロジェクト資料だけ切り替えるユースケースが多い | プロジェクト切り替え時にターミナルも全てリセット |
| `recentProjects` を `partialize` から除外 | config.json を単一の真実の源にする | localStorage にも保存して起動高速化 |
| プロジェクト名クリックでドロップダウン | 既存ヘッダーのスペースを活かせる。専用ボタンより直感的 | 「最近のプロジェクト」専用ボタンを追加 |

## 未解決事項

- [ ] 存在しないパスが履歴に含まれる場合の UX（グレーアウト vs 自動除去）
- [ ] Tauri v2 での `app_handle.path().config_dir()` の動作確認（macOS: `~/Library/Application Support`）
