# 設計書 - Phase 3-A: ドキュメントステータス管理

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    TreeNode（バッジ表示）
    ContextMenu（ステータスサブメニュー）
    frontmatter.ts（解析・書き換えユーティリティ）
    appStore（docStatuses キャッシュ）
         ↓ invoke()
Tauri IPC
         ↓
Rust Backend
    filesystem.rs（write_file 追加）
         ↓
ファイルシステム
```

### 影響範囲

- **フロントエンド**: `TreeNode`, `ContextMenu`, `appStore`, 新規 `frontmatter.ts`
- **バックエンド（Rust）**: `filesystem.rs`（`write_file` 追加）, `lib.rs`

---

## 実装方針

### 概要

フロントマターの解析・書き換えは TypeScript 側で完結させる（外部ライブラリなし）。Rust 側には `write_file` コマンドのみ追加する。ステータスは `appStore` の `docStatuses: Record<string, DocStatus | null>` にキャッシュし、ツリー全体で共有する。

### 詳細

1. **フロントマター解析（`frontmatter.ts`）**: 正規表現でフロントマターブロックを抽出し、`status` フィールドのみ読み取る。書き換え時は既存フロントマターを更新 or 先頭に新規挿入する。
2. **ステータス読み込みタイミング**: ディレクトリ展開時（`updateDirChildren` が呼ばれるタイミング）に、配下の MD/MDX ファイルを `read_file` → `parseStatus` して `docStatuses` を更新する。
3. **ステータス変更**: コンテキストメニューから選択 → `read_file` → `setStatus` → `write_file` → `docStatuses` を即時更新。
4. **バッジ表示**: `TreeNode` で `docStatuses[node.path]` を参照し、色付き丸点を表示する。

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/frontmatter.ts
export type DocStatus = 'draft' | 'reviewing' | 'approved'

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: '草稿',
  reviewing: 'レビュー中',
  approved: '承認済',
}

export const DOC_STATUS_COLOR: Record<DocStatus, string> = {
  draft: '#6b7280',
  reviewing: '#eab308',
  approved: '#22c55e',
}

/** フロントマターから status を取得。なければ null */
export function parseStatus(content: string): DocStatus | null { ... }

/** ファイル内容の status フィールドを更新した文字列を返す */
export function setStatus(content: string, status: DocStatus): string { ... }
```

```typescript
// appStore.ts に追加
docStatuses: Record<string, DocStatus | null>
setDocStatus: (path: string, status: DocStatus | null) => void
loadDocStatuses: (paths: string[]) => Promise<void>  // MD ファイルのステータスを非同期一括読み込み
```

### 型定義（Rust）

```rust
// filesystem.rs に追加
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}
```

---

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `write_file` | `path: String, content: String` | `Result<(), String>` | ファイルを上書き保存する |

※ `read_file` は Phase 2-A で実装済み。フロントマター解析は TypeScript 側で行う。

### Tauriイベント

なし

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-context-menu` | ステータスサブメニュー | 既存の ContextMenu に追加 |
| `lucide-react` | `Check` アイコン（現在のステータスに表示） | 既存利用 |

### カラーパレット

ステータスバッジは固定色を使用（CSS カスタムプロパティに依存しない）：

| ステータス | 色 | 説明 |
|-----------|-----|------|
| `draft` | `#6b7280` | グレー（Tailwind gray-500） |
| `reviewing` | `#eab308` | イエロー（Tailwind yellow-500） |
| `approved` | `#22c55e` | グリーン（Tailwind green-500） |

### 画面構成

#### TreeNode のバッジ表示

```
┌─────────────────────────────────────┐
│ ▼ src                               │
│   📄 main.tsx                       │
│   📝 README.md              ●       │  ← approved（緑）
│   📝 requirements.md        ●       │  ← reviewing（黄）
│   📝 design.md                      │  ← 未設定（表示なし）
└─────────────────────────────────────┘
```

バッジは行の右端（`pr-2` の内側）に配置し、ファイル名とは右揃えで表示する。

#### コンテキストメニューのステータスサブメニュー

```
┌─────────────────────────┐
│ パスをターミナルに挿入   │
│ ────────────────────── │
│ 新規ファイル            │
│ 新規フォルダ            │
│ ────────────────────── │
│ ステータス            ▶ │──→ ┌────────────┐
│ 外部エディタで開く      │    │ ✓ 草稿      │
│ ────────────────────── │    │   レビュー中 │
│ リネーム               │    │   承認済    │
│ 削除                   │    └────────────┘
└─────────────────────────┘
```

MD/MDX ファイルの場合のみ「ステータス」サブメニューを表示する。

### コンポーネント構成

```
TreeNode
  └─ ContextMenu（変更）
       └─ ContextMenu.Sub（Radix UI）
            ├─ ContextMenu.SubTrigger（"ステータス"）
            └─ ContextMenu.SubContent
                 ├─ MenuItem（草稿）
                 ├─ MenuItem（レビュー中）
                 └─ MenuItem（承認済）
  └─ バッジ（inline span）
```

---

## 状態管理

### Zustand ストア変更（appStore.ts）

```typescript
// 追加フィールド・アクション（Phase 2-F）
docStatuses: Record<string, DocStatus | null>
setDocStatus: (path: string, status: DocStatus | null) => void
loadDocStatuses: (paths: string[]) => Promise<void>

// loadDocStatuses の実装イメージ
loadDocStatuses: async (paths) => {
  const mdPaths = paths.filter((p) => /\.(md|mdx)$/.test(p))
  await Promise.all(
    mdPaths.map(async (path) => {
      try {
        const content = await tauriApi.readFile(path)
        const status = parseStatus(content)
        set((s) => ({ docStatuses: { ...s.docStatuses, [path]: status } }))
      } catch {
        // 読み込み失敗は無視
      }
    })
  )
}
```

`docStatuses` は `partialize` に含めない（揮発性キャッシュ。再起動時に再読み込み）。

---

## フロントマター解析ロジック詳細

```typescript
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseStatus(content: string): DocStatus | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null
  const m = match[1].match(/^status:\s*(\S+)/m)
  if (!m) return null
  const s = m[1]
  return (s === 'draft' || s === 'reviewing' || s === 'approved') ? s : null
}

export function setStatus(content: string, status: DocStatus): string {
  const match = content.match(FRONTMATTER_RE)
  if (match) {
    // 既存フロントマターの status を更新（なければ追加）
    const fm = match[1]
    const updated = /^status:/m.test(fm)
      ? fm.replace(/^status:.*$/m, `status: ${status}`)
      : `${fm}\nstatus: ${status}`
    return content.replace(match[0], `---\n${updated}\n---\n`)
  }
  // フロントマターがない場合は先頭に挿入
  return `---\nstatus: ${status}\n---\n\n${content}`
}
```

---

## テストコード

### Rustテスト

```rust
// filesystem.rs
#[cfg(test)]
mod tests {
    #[test]
    fn test_write_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.md").to_str().unwrap().to_string();
        write_file(path.clone(), "# hello".to_string()).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "# hello");
    }
}
```

### フロントマターユーティリティテスト（手動確認）

| 入力 | 期待される `parseStatus` 結果 |
|------|-------------------------------|
| `---\nstatus: draft\n---\n# ...` | `'draft'` |
| `---\ntitle: foo\nstatus: approved\n---` | `'approved'` |
| `---\ntitle: foo\n---\n# ...` | `null` |
| `# No frontmatter` | `null` |
| `---\nstatus: unknown\n---` | `null` |

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| フロントマター解析を TypeScript 側で実施 | Rust コマンドを増やさずシンプルに保つ。ファイルはすでに `read_file` で取得している | Rust 側に専用コマンドを追加 |
| 外部ライブラリなし（正規表現ベース） | `gray-matter` 等の追加はバンドルサイズを増やす。仕様書のフロントマターはシンプルな構造のみ | `gray-matter` を使用 |
| `docStatuses` はキャッシュのみ（非永続化） | ファイルが正の情報源。再起動時に再読み込みで常に最新を保証 | localStorage に永続化 |
| ディレクトリ展開時に一括ロード | 展開タイミングが最も自然。ユーザーが見るタイミングに合わせてロード | ファイル選択時にロード（ツリーに表示されない） |

## 未解決事項

- [ ] フロントマター内の `status` フィールドの前後にコメントや複雑な YAML がある場合の挙動（現状は未対応）
