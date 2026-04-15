# 設計書 - file-tree-dnd

## アーキテクチャ

### 対象コンポーネント

```
[内部 DnD]                              [外部 DnD（Finder）]
TreeNode (HTML5 draggable)             OS dragdrop
    │ dataTransfer に対象パス JSON      │
    ▼                                   ▼
TreeNode/TreePanel onDragOver/Drop    getCurrentWebview().onDragDropEvent
    │                                   │ (paths[], position)
    └──────────────┬────────────────────┘
                   ▼
            useTreeDnd（共通フック）
            - ヒットテスト（elementFromPoint）
            - 自己／子孫判定
            - 確認ダイアログ
                   │
                   ▼
            invoke("rename_path") / invoke("copy_path")
                   │
                   ▼
            Rust filesystem commands
                   │
                   ▼
            ファイルシステム
                   │
                   ▼
            updateDirChildren / renameTabPath / トースト
```

### 影響範囲

- **フロントエンド**:
  - `src/components/TreePanel/TreeNode.tsx` — `draggable`、drag handlers、`data-*` 属性
  - `src/components/TreePanel/TreePanel.tsx` — ルート領域 drop、外部 DnD リスナ登録、トースト／ダイアログ配置
  - `src/hooks/useTreeDnd.ts` — 新設、DnD 判定と実行を集約
  - `src/stores/appStore.ts` — `dragOverPath` 追加
  - `src/lib/tauriApi.ts` — `copyPath` ラッパー追加
  - `src/components/Toast/`（既存基盤に乗らない場合は新設）
- **バックエンド（Rust）**:
  - `src-tauri/src/commands/filesystem.rs` — `copy_path` 追加
  - `src-tauri/src/commands/mod.rs` — export 追加
  - `src-tauri/src/lib.rs` — `invoke_handler` に登録
- **設定**:
  - `src-tauri/tauri.conf.json` — `app.windows[0].dragDropEnabled: true`

## 実装方針

### 概要

UI 層から DnD ロジックを切り離し、`useTreeDnd` フックに集約する。内部 DnD は HTML5 DnD API、外部 DnD は Tauri の `onDragDropEvent` を入力源とし、最終的に同一の判定・実行ロジックを通る。Rust 側は既存 `rename_path` を流用しつつ、コピー用に `copy_path`（再帰対応）を新設する。

### 詳細

1. **設定変更**: `tauri.conf.json` の `dragDropEnabled` を `true` にする（OS 経由のファイル drop イベントを Tauri が捕捉できるようにする）。
2. **Rust `copy_path` 追加**: ファイル単体は `fs::copy`、ディレクトリは再帰コピー。最終パス衝突は `Err`。`tokio::task::spawn_blocking` でラップして UI を止めない。
3. **`useTreeDnd` フック新設**:
   - `handleInternalDrop(srcPaths, destDir)` / `handleExternalDrop(srcPaths, destDir)` の 2 エントリ。
   - 自己／子孫判定、件数集計、確認ダイアログ、コマンド呼び出し、結果集計、トースト発火、`updateDirChildren` / `renameTabPath` 反映までを担う。
4. **`TreeNode` 拡張**:
   - 行ラッパに `draggable`、`data-tree-node`, `data-is-dir`, `data-path` を付与。
   - `onDragStart` で `text/x-spec-prompt-paths` MIME に対象パス JSON 配列を載せる（複数選択対応）。
   - `onDragOver` で MIME 確認＋自己／子孫チェック後 `preventDefault` を呼んで drop 可能化。
   - `onDragLeave` でハイライト解除。
   - `onDrop` で `useTreeDnd.handleInternalDrop` を呼ぶ。
5. **`TreePanel` 拡張**:
   - ツリー余白領域にも drag handlers を付与し、ドロップ先 `destDir = projectRoot` として扱う。
   - 起動時に `getCurrentWebview().onDragDropEvent` を 1 回だけ登録し、`drag-over`／`drag-drop` のたびに `elementFromPoint(position.x, position.y).closest('[data-tree-node][data-is-dir="true"]')` でドロップ先を逆引き → `useTreeDnd` に渡す。
6. **状態管理**:
   - `appStore` に `dragOverPath: string | null` を追加。`TreeNode` は自分のパスが一致するときだけハイライト適用（再描画粒度の最小化）。
7. **トースト**: 既存基盤がなければ最小実装（成功／エラー／情報）。
8. **i18n**: ダイアログ・トースト・ハイライト関連の文言を `locales/{en,ja}.json` に追加。

## データ構造

### 型定義（TypeScript）

```typescript
type DropOperation = "move" | "copy"

type DropResult = {
  succeeded: { src: string; dest: string }[]
  skipped: { src: string; reason: string }[]
}

type TreeDragPayload = {
  paths: string[]   // dataTransfer に JSON 文字列で載せる
}

// appStore への追加
interface AppState {
  dragOverPath: string | null
  setDragOverPath: (path: string | null) => void
  // ... 既存
}
```

カスタム MIME: `text/x-spec-prompt-paths`

### 型定義（Rust）

`copy_path` は引数 / 戻り値ともプリミティブのみで構造体は不要。

```rust
// src-tauri/src/commands/filesystem.rs
#[tauri::command]
pub async fn copy_path(src: String, dest_dir: String) -> Result<String, String>
// 戻り値はコピー後の最終パス
```

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `rename_path`（既存） | `oldPath: String, newPath: String` | `Result<(), String>` | 内部移動。既存実装を流用 |
| `copy_path`（新規） | `src: String, destDir: String` | `Result<String, String>` | `src` を `destDir` 配下へ再帰コピー。最終パスを返す。同名衝突は Err |

### Tauriイベント

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `tauri://drag-enter`（既存・組み込み） | `{ paths: string[], position: PhysicalPosition }` | OS DnD 開始（外部 DnD 検出） |
| `tauri://drag-over`（既存・組み込み） | 同上 | OS DnD ドラッグ中。ハイライト更新に利用 |
| `tauri://drag-drop`（既存・組み込み） | 同上 | OS DnD ドロップ確定。`useTreeDnd.handleExternalDrop` を起動 |
| `tauri://drag-leave`（既存・組み込み） | なし | OS DnD キャンセル。ハイライト解除 |

`dragDropEnabled: true` でこれらの組み込みイベントが有効化される。新規 emit 側のイベントは追加しない。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-alert-dialog` | 件数確認ダイアログ | 既存 `DeleteDialog` で実績あり、同流儀で実装 |
| `lucide-react` | カーソル状態に応じたアイコン（v1 ではフォルダのまま） | tree-shaking 対応 |

### カラーパレット

`src/index.css` 定義済みの CSS カスタムプロパティを使用：

- `--color-bg-elevated` — ドロップターゲットのベースハイライト
- `--color-accent` — ドロップ可能を強調する境界線色（`color-mix(in srgb, var(--color-accent) 30%, transparent)` 等）
- `--color-text-muted` — 禁止表示時の薄字
- `--color-border` — 既存に揃える

### 画面構成

ツリーパネル（`TreePanel`）の表示構成は変更しない。以下のみ追加：

- ドラッグ中のノード行: `opacity-50`
- ドロップターゲット（フォルダ行・ルート余白）: 背景に `--color-bg-elevated` + 左ボーダー `--color-accent`
- 確認ダイアログ: 既存 `DeleteDialog` と同位置（モーダル中央）
- 結果トースト: 画面右下にスタック表示

### コンポーネント構成

- `TreeNode`（拡張）
- `TreePanel`（拡張、ルート drop 領域 + 外部 DnD リスナ）
- `useTreeDnd`（新設フック）
- `Toast` / `ToastProvider`（既存基盤がなければ最小実装で新設）
- `ConfirmDropDialog`（既存 `DeleteDialog` を参考に新設、または共通化）

## 状態管理

### Zustandストア変更

```typescript
// src/stores/appStore.ts に追加
interface AppState {
  // ... 既存
  dragOverPath: string | null
  setDragOverPath: (path: string | null) => void
}

// 実装
dragOverPath: null,
setDragOverPath: (path) => set({ dragOverPath: path }),
```

`contentStore` / `terminalStore` に変更は無し。既存の `renameTabPath`（`contentStore`）と `updateDirChildren`／`setSelectedFile`（`appStore`）を流用。

## テストコード

### Reactコンポーネントテスト例

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeDnd } from '../useTreeDnd'

describe('useTreeDnd - 自己/子孫チェック', () => {
  it('同じ親フォルダへの移動は no-op として扱う', async () => {
    const invoke = vi.fn()
    const { result } = renderHook(() => useTreeDnd({ invoke }))
    await act(async () => {
      await result.current.handleInternalDrop(['/p/docs/a.md'], '/p/docs')
    })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('フォルダを自身の子孫へ移動しようとすると拒否する', async () => {
    const invoke = vi.fn()
    const { result } = renderHook(() => useTreeDnd({ invoke }))
    await act(async () => {
      const r = await result.current.handleInternalDrop(['/p/src'], '/p/src/sub')
      expect(r.skipped).toHaveLength(1)
    })
    expect(invoke).not.toHaveBeenCalled()
  })
})
```

### Rustテスト例

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_copy_path_file() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("a.md");
        let dest_dir = dir.path().join("dest");
        std::fs::create_dir(&dest_dir).unwrap();
        std::fs::write(&src, "hello").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        ).await;
        assert!(result.is_ok());
        assert_eq!(std::fs::read_to_string(dest_dir.join("a.md")).unwrap(), "hello");
        assert!(src.exists()); // コピーなので元は残る
    }

    #[tokio::test]
    async fn test_copy_path_directory_recursive() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        let dest_dir = dir.path().join("dest");
        std::fs::create_dir(&src).unwrap();
        std::fs::create_dir(&dest_dir).unwrap();
        std::fs::write(src.join("a.txt"), "x").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        ).await;
        assert!(result.is_ok());
        assert!(dest_dir.join("src/a.txt").exists());
    }

    #[tokio::test]
    async fn test_copy_path_conflict_errors() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("a.md");
        let dest_dir = dir.path().join("dest");
        std::fs::create_dir(&dest_dir).unwrap();
        std::fs::write(&src, "x").unwrap();
        std::fs::write(dest_dir.join("a.md"), "old").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        ).await;
        assert!(result.is_err());
        assert_eq!(std::fs::read_to_string(dest_dir.join("a.md")).unwrap(), "old");
    }
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| 外部 DnD は Tauri の `onDragDropEvent` を使う | Finder からの絶対パスが必要、HTML5 の File オブジェクトでは macOS でパスが取れない | Webview 側で File API を使う案（パス取得不可で却下） |
| `dragDropEnabled` を `true` に変更 | OS DnD イベントを Tauri で受けるための前提 | `false` のまま HTML5 で受ける（パス取得不可で却下） |
| 内部 DnD は HTML5 DnD API | ライブラリ追加なしで足りる、既存 React 19 でそのまま動く | dnd-kit / react-dnd 導入（複雑度に見合わない） |
| 外部コピーは `copy_path` を新設 | `rename_path` は移動。コピーは別意味、Finder 慣習にも合う | `rename_path` の動作を分岐させる（意味が曖昧化するため却下） |
| 同名衝突は自動リネームせずエラー | 暗黙の挙動でユーザーを混乱させない、v1 のシンプル化 | `foo (1).md` 自動付与（v1.1 以降で検討） |
| 内部移動は移動、外部 DnD はコピー固定 | OS 慣習（Finder の異ボリューム間 DnD はコピー）に合わせる、修飾キー UI を増やさない | Option/Shift で切替（v2 で検討） |
| ヒットテストは `elementFromPoint` | OS DnD イベントは座標しか持たないため | 全ノードを R-tree でインデックス（過剰設計） |
| ハイライト状態は `appStore.dragOverPath` 単一値で持つ | 単一ターゲット前提で十分、再描画も最小化 | 各 `TreeNode` のローカル state（多数ノード再描画） |

## 未解決事項

- [x] 既存トースト基盤の有無確認 → 無かったので `src/components/Toast/` に最小実装
- [ ] 外部 DnD 進捗トーストの粒度（per-file 進捗 vs サマリのみ）
- [ ] `i18n` の用語: 「移動」「コピー」「ドロップ先」等の英語表記揺れの確認
- [ ] 大容量ファイルの閾値（100MB / 50 ファイル）の最終調整
- [ ] フォルダ DnD 中の fs watch イベントによる中間描画の見え方（許容範囲か）

---

## 実装後の補足（v1 実装時の知見）

### macOS Tauri v2 の挙動と採用した対策

実装時、当初の「外部 DnD を Tauri イベント、内部 DnD を HTML5 イベント」という明確な役割分担では **macOS で内部 DnD の drop が検出できない** 問題が発生した。

観測された挙動:
- `dragDropEnabled: true` の状態でも、ページ内の HTML5 `dragstart` は正常に発火する
- しかし `dragover` / `drop` は OS レベルで Tauri の NSDraggingDestination 実装に横取りされ、Tauri 側の `onDragDropEvent` に `over` イベントだけが多数流れる
- 内部ドラッグ（`NSFilenamesPboardType` を持たない）の drop について、Tauri 側で drop を emit しないケースと、`paths: []` で emit するケースがあり挙動が不安定

採用したハイブリッド方針:

1. **内部ドラッグ状態の共有**: `appStore.internalDragPaths` に、HTML5 `dragstart` の時点で対象パス配列をセット。Tauri イベント側から参照できるようにする。
2. **二重ハンドリング**:
   - `TreeNode` / `TreePanel` に HTML5 の `onDragOver` / `onDrop` を付け、到達する場合はそちらで内部移動を実行
   - Tauri の `onDragDropEvent` 側でも drop を処理。内部ドラッグ状態が立っていれば `handleInternalDrop`、空なら `handleExternalDrop`（Finder からのコピー）
3. **座標系揺れ対応**: `onDragDropEvent.position` は型上 `PhysicalPosition` だが、macOS では実態として CSS ピクセルで届くことがある。`findDestDir` では CSS そのままと DPR で割った値の両方で `elementFromPoint` を試し、先にヒットしたほうを採用する。
4. **dragEnd の遅延クリア**: `onDragEnd` で `internalDragPaths` を即時クリアすると、Tauri 側の drop 処理より先にクリアされてしまうケースがある。300ms 遅延してクリアすることで、どちらの経路でも drop を処理できるようにした。

この構成により、macOS 実機で内部ドラッグ移動・Finder からの外部コピーの両方が動作することを確認済み。
