# 設計書 - status-bar-phase1

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ├─ AppLayout.tsx            ← レイアウト変更（flex-col 化）
    │    ├─ SplitPane + TreePanel + MainArea （既存）
    │    └─ StatusBar.tsx       ← 新規スケルトン
    └─ lib/tauriApi.ts           ← getBranch ラッパー追加
        ↓ invoke("git_branch")
Tauri IPC
    ↓
Rust Backend
    └─ commands/git.rs           ← git_branch 関数追加
        ↓ std::process::Command
git CLI
```

### 影響範囲

- **フロントエンド**:
  - `src/components/Layout/AppLayout.tsx` — `flex h-full` → `flex flex-col h-full` に変更し、下段へ `<StatusBar />` を配置
  - `src/components/StatusBar/StatusBar.tsx` — 新規追加（スケルトン）
  - `src/lib/tauriApi.ts` — `getBranch` ラッパーを `getGitStatus` の近くに追加
- **バックエンド（Rust）**:
  - `src-tauri/src/commands/git.rs` — `git_branch` 関数と単体テストを追加
  - `src-tauri/src/lib.rs` — `use` 行および `invoke_handler!` に `git_branch` を追加

## 実装方針

### 概要

Phase 1 は**機能の骨格を作る**ことに徹し、実データの流し込みは Phase 2 に委ねる。`StatusBar` コンポーネントは Props を受け取らないスケルトンとして追加し、中身の描画は後続 Phase で置き換える。Rust コマンドは戻り値の型を固め、将来的にフロントが呼び出したときの挙動を明確にする。

### 詳細

1. **Rust コマンド追加**
   - `git.rs` に `git_branch(cwd: String) -> Result<Option<String>, String>` を実装
   - 通常ブランチは `rev-parse --abbrev-ref HEAD`、`HEAD` 文字列が返った場合は `rev-parse --short HEAD` を追加実行
   - `Command::spawn` エラー、非ゼロ終了は `Ok(None)` に丸める
2. **コマンド登録**
   - `lib.rs` の `use commands::git::git_status` に `git_branch` を追記
   - `invoke_handler!` の並びに `git_branch` を追加
3. **フロント IPC ラッパー**
   - `tauriApi.ts` の Git セクションに `getBranch` を追加（`Promise<string | null>`）
4. **レイアウト変更**
   - `AppLayout.tsx` のルート `<div>` を `flex flex-col h-full w-full` に変更
   - 既存 `SplitPane` を `<div className="flex-1 min-h-0">` でラップして縦方向の高さ衝突を回避
   - その下に `<StatusBar />` を配置
5. **StatusBar スケルトン**
   - `h-7` 固定、`border-t`、背景・テキスト色は CSS 変数
   - Phase 2 で配置する `BranchIndicator` / `FileTypeIndicator` のための空 `<div>` のみ置く

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/tauriApi.ts に追加
export const tauriApi = {
  // ...existing...
  getBranch: (cwd: string): Promise<string | null> =>
    invoke("git_branch", { cwd }),
}
```

### 型定義（Rust）

戻り値は既存と同じ `Result` パターン。独自の struct は追加しない。

```rust
// src-tauri/src/commands/git.rs に追加
#[tauri::command]
pub fn git_branch(cwd: String) -> Result<Option<String>, String> {
    // 実装
}
```

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `git_branch` | `{ cwd: string }` | `Result<Option<String>, String>` | 指定 cwd の現在ブランチ名。detached HEAD は短縮 SHA。Git 非検出時は `Ok(None)` |

### Tauriイベント

Phase 1 では追加しない（Phase 2 でも Tauri イベントは追加せず、フロント側のポーリングのみで完結する方針）。

## UI設計

### UIライブラリ

Phase 1 では特別なライブラリは追加しない。既存の Tailwind v4 + CSS カスタムプロパティのみ使用。

### カラーパレット

`src/index.css` で定義済みの CSS カスタムプロパティを使用する：

- `--color-bg-elevated` — ステータスバー背景
- `--color-border` — ステータスバー上端ボーダー
- `--color-text-muted` — Phase 2 で配置する文字色

### 画面構成

```
┌──────────────────────────────────────────────┐
│ TreePanel │ MainArea                         │
│           │                                  │
│           │                                  │
│           │                                  │
├───────────┴──────────────────────────────────┤ ← 新規: border-t 1px
│ (Phase1 では空) StatusBar h-7                │ ← 新規
└──────────────────────────────────────────────┘
```

### コンポーネント構成

- `StatusBar` は引数なしの純粋コンポーネント。Phase 2 で `cwd` や内部の子コンポーネントを受け取るよう拡張する。

## 状態管理

### Zustandストア変更

Phase 1 ではストア変更なし。`StatusBar` は props を持たず、ストア購読も行わない。

## テストコード

### Reactコンポーネントテスト例

Phase 1 のスケルトンは可視的なロジックを持たないため、レンダリングテストのみ用意する（任意）。

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
  it('画面下段に 28px の帯を描画する', () => {
    const { container } = render(<StatusBar />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/h-7/)
  })
})
```

### Rustテスト例

`tempfile` クレートで一時 Git リポジトリを作成し、3 ケースを確認する。

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    fn init_repo(dir: &std::path::Path) {
        Command::new("git").args(["init", "-q", "-b", "main"]).current_dir(dir).status().unwrap();
        std::fs::write(dir.join("README.md"), "x").unwrap();
        Command::new("git").args(["add", "."]).current_dir(dir).status().unwrap();
        Command::new("git")
            .args(["-c", "user.email=t@e", "-c", "user.name=t", "commit", "-qm", "init"])
            .current_dir(dir).status().unwrap();
    }

    #[test]
    fn test_git_branch_returns_branch_name() {
        let td = TempDir::new().unwrap();
        init_repo(td.path());
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(result, Some("main".to_string()));
    }

    #[test]
    fn test_git_branch_detached_returns_short_sha() {
        let td = TempDir::new().unwrap();
        init_repo(td.path());
        // detached HEAD にする
        let sha = Command::new("git").args(["rev-parse", "HEAD"]).current_dir(td.path()).output().unwrap();
        let sha_full = String::from_utf8_lossy(&sha.stdout).trim().to_string();
        Command::new("git").args(["checkout", "-q", &sha_full]).current_dir(td.path()).status().unwrap();
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert!(result.is_some());
        assert_ne!(result, Some("HEAD".to_string()));
    }

    #[test]
    fn test_git_branch_non_repo_returns_none() {
        let td = TempDir::new().unwrap();
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(result, None);
    }
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `git_branch` の戻り値を `Result<Option<String>, String>` とする | Git 非検出と「IPC 呼び出し自体の失敗」を区別したい。UI は `None` を想定して空表示に切り替えるだけで済む | `Result<String, String>` で非 Git を `Err` にする案もあるが、UI 側で `.catch` を毎回書く必要があり煩雑 |
| detached HEAD 時は短縮 SHA を返す | ブランチ名欄に `HEAD` とだけ表示されても意味がないため | 空文字を返して UI 非表示にする案もあるが、ユーザーが「何か作業状態にある」ことを認識できる方が有益 |
| Phase 1 では `StatusBar` を props なしで実装 | Phase 2 の変更差分を最小化するため（配置のみの変更を先にマージ） | Phase 1 から `cwd` を受け取る案もあるが未使用 prop となり lint 警告を招く |
| 子プロセス実行は既存パターン（`std::process::Command`）を踏襲 | 依存追加なし。`git2` クレートは依存サイズが大きく、初期実装では過剰 | 将来パフォーマンス問題が出れば `git2` 化を検討 |

## 未解決事項

- [ ] `tempfile` クレートが `src-tauri/Cargo.toml` の `dev-dependencies` に含まれているか要確認（含まれていなければ T1-1 のテスト追加時にあわせて追加）
