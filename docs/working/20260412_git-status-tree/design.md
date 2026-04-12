# 設計書 - Git ステータスのプロジェクトツリー表示

## アーキテクチャ

### データフロー

```
Rust Backend
  │ git_status コマンド
  │   └─ std::process::Command("git", "status", "--porcelain=v1")
  │      → パース → HashMap<String, GitFileStatus>
  │
  ▼ Tauri IPC (invoke)
Frontend
  │
  ├── appStore.gitStatuses: Map<path, GitFileStatus>
  │
  └── TreeNode.tsx
        ├── ファイル名の color を gitStatus に応じて変更
        └── 右端にステータスバッジ（M / A / D / U）を表示
```

### 影響範囲

- **バックエンド（Rust）**: `commands/git.rs`（新規）、`lib.rs`（コマンド登録）
- **フロントエンド**: `tauriApi.ts`、`appStore.ts`、`TreeNode.tsx`

---

## 実装方針

### Rust 側: `git status --porcelain=v1` のパース

`git status --porcelain=v1` の出力形式:
```
XY path
XY old_path -> new_path  (リネーム時)
```

- X = ステージング領域のステータス
- Y = ワーキングツリーのステータス
- `?` = 未追跡, `!` = 無視, `M` = 変更, `A` = 追加, `D` = 削除, `R` = リネーム

外部クレート不要（`std::process::Command` で十分）。

### フロントエンド側: 色の適用

TreeNode の `<span className="truncate flex-1">` にインラインスタイルで `color` を設定。
ディレクトリへの伝播は appStore 側でフラットな Map を走査して判定する。

---

## データ構造

### Rust 型定義

```rust
#[derive(Debug, Clone, Serialize)]
pub struct GitFileStatus {
    /// ステージング領域のステータス (' ', 'M', 'A', 'D', 'R', '?')
    pub staged: char,
    /// ワーキングツリーのステータス (' ', 'M', 'A', 'D', '?')
    pub unstaged: char,
}
```

### TypeScript 型定義

```typescript
export interface GitFileStatus {
  staged: string    // ' ' | 'M' | 'A' | 'D' | 'R' | '?'
  unstaged: string  // ' ' | 'M' | 'D' | '?'
}
```

### appStore 追加フィールド

```typescript
interface AppState {
  // ... 既存フィールド
  gitStatuses: Record<string, GitFileStatus>
  setGitStatuses: (statuses: Record<string, GitFileStatus>) => void
  refreshGitStatus: () => Promise<void>
}
```

---

## API 設計

### Tauri コマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `git_status` | `cwd: String` | `Result<HashMap<String, GitFileStatus>, String>` | 指定ディレクトリの Git ステータスを取得 |

### Rust 実装概要

```rust
#[tauri::command]
pub fn git_status(cwd: String) -> Result<HashMap<String, GitFileStatus>, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v1", "-uall"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Not a git repository".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut statuses = HashMap::new();

    for line in stdout.lines() {
        if line.len() < 4 { continue; }
        let staged = line.chars().nth(0).unwrap_or(' ');
        let unstaged = line.chars().nth(1).unwrap_or(' ');
        let path_str = &line[3..];
        // リネーム: "old -> new" 形式
        let path = if let Some(idx) = path_str.find(" -> ") {
            &path_str[idx + 4..]
        } else {
            path_str
        };
        let full_path = format!("{}/{}", cwd, path);
        statuses.insert(full_path, GitFileStatus { staged, unstaged });
    }

    Ok(statuses)
}
```

---

## UI 設計

### ファイル名カラー

```typescript
const GIT_STATUS_COLOR: Record<string, string> = {
  modified_unstaged: '#e2c08d',  // 黄
  modified_staged:   '#73c991',  // 緑
  added:             '#73c991',  // 緑
  untracked:         '#73c991',  // 緑
  deleted:           '#c74e39',  // 赤
  conflict:          '#e5c07b',  // 橙
}

function getGitColor(status: GitFileStatus | undefined): string | undefined {
  if (!status) return undefined
  // unstaged が優先（ワーキングツリーの変更が目立つべき）
  if (status.unstaged === 'M') return GIT_STATUS_COLOR.modified_unstaged
  if (status.unstaged === 'D') return GIT_STATUS_COLOR.deleted
  if (status.staged === '?' || status.unstaged === '?') return GIT_STATUS_COLOR.untracked
  if (status.staged === 'A') return GIT_STATUS_COLOR.added
  if (status.staged === 'M') return GIT_STATUS_COLOR.modified_staged
  if (status.staged === 'D') return GIT_STATUS_COLOR.deleted
  if (status.staged === 'R') return GIT_STATUS_COLOR.added
  if (status.staged === 'U' || status.unstaged === 'U') return GIT_STATUS_COLOR.conflict
  return undefined
}
```

### ステータスバッジ

```tsx
{gitBadge && (
  <span
    className="shrink-0 text-[10px] ml-1 font-mono"
    style={{ color: gitColor }}
  >
    {gitBadge}
  </span>
)}
```

バッジ文字: `M`(Modified), `A`(Added), `D`(Deleted), `U`(Untracked), `R`(Renamed), `C`(Conflict)

### ディレクトリへの伝播

ディレクトリの色は、その配下に変更ファイルがあれば最も優先度の高い色を採用する。
判定は `gitStatuses` の全キーを走査し、`path.startsWith(dirPath + '/')` でフィルタする。

```typescript
function getDirGitColor(dirPath: string, gitStatuses: Record<string, GitFileStatus>): string | undefined {
  const prefix = dirPath + '/'
  for (const [path, status] of Object.entries(gitStatuses)) {
    if (path.startsWith(prefix)) {
      const color = getGitColor(status)
      if (color) return color  // 最初に見つかった色を返す（簡易版）
    }
  }
  return undefined
}
```

---

## 自動更新トリガー

| トリガー | 実装 |
|---------|------|
| プロジェクト読み込み時 | `appStore.setProjectRoot` 内で `refreshGitStatus()` 呼び出し |
| ターミナル出力後 | `pty-output` イベントのリスナーで 500ms デバウンス付き `refreshGitStatus()` |
| ファイル保存後 | `writeFile` コマンド呼び出し後に `refreshGitStatus()` |

デバウンスは appStore 内の `refreshGitStatus` に組み込む（直近の呼び出しから 500ms 経過後に実行）。

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `git` コマンド直接実行 | 外部クレート不要で軽量。porcelain 出力は安定した仕様 | `git2` クレート（バイナリサイズ増大） |
| フラットな Map で管理 | ツリー構造に依存せず、パスベースで直接ルックアップ可能 | ツリーに status を持たせる（更新が複雑） |
| unstaged 優先の色付け | ワーキングツリーの変更が最も注目すべき情報 | staged 優先 |
