# 開発ガイドライン

**バージョン**: 1.0
**作成日**: 2026年3月28日
**最終更新**: 2026年3月28日

---

## 1. 開発環境セットアップ

### 1.1 必要なツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 18.x以上 | フロントエンド実行環境 |
| npm | 9.x以上 | パッケージ管理 |
| Rust | 1.70以上 | バックエンド開発 |
| Tauri CLI | 2.x（`@tauri-apps/cli`） | Tauriアプリ開発 |

### 1.2 初期セットアップ

```bash
git clone https://github.com/your-repo/spec-prompt.git
cd spec-prompt
npm install
# Rust依存関係は初回ビルド時に自動インストール
```

### 1.3 開発コマンド

```bash
# Tauriアプリを起動（推奨）
npx tauri dev

# フロントエンドのみ起動（Tauri API使用不可）
npm run dev

# フロントエンドのlint
npm run lint

# プロダクションビルド（.app と .dmg を生成）
npx tauri build

# Rustの型チェック
cd src-tauri && cargo check

# Rustテスト
cd src-tauri && cargo test

# Rustテスト（単体指定）
cd src-tauri && cargo test <test_name>
```

---

## 2. コーディング規約

### 2.1 TypeScript / React

#### 基本ルール

```typescript
// ✅ Good: 明示的な型定義
const ptyId: string = 'pty-0'
function spawnPty(shell: string, cwd: string): Promise<string> {
  // ...
}

// ❌ Bad: any型の使用
const data: any = response

// ✅ Good: 型推論が明らかな場合は省略可
const count = 0
const items = [] as FileNode[]
```

#### インポート順序

```typescript
// 1. React / フレームワーク
import { useState, useEffect, useRef } from 'react'

// 2. 外部ライブラリ
import { Terminal } from '@xterm/xterm'
import { invoke } from '@tauri-apps/api/core'

// 3. 内部モジュール（相対パス）
import { useAppStore } from '../../stores/appStore'
import type { FileNode } from '../../lib/tauriApi'

// 4. CSS
import '@xterm/xterm/css/xterm.css'
```

#### React コンポーネント

```tsx
interface TerminalPanelProps {
  cwd?: string
  onReady?: (ptyId: string) => void
}

export function TerminalPanel({ cwd = '/', onReady }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // ...
  return <div ref={containerRef} className="w-full h-full" />
}
```

#### エラーハンドリング

```typescript
// ✅ Good: Tauri invoke のエラーハンドリング
async function spawnTerminal(cwd: string) {
  try {
    const id = await tauriApi.spawnPty('/bin/zsh', cwd)
    return id
  } catch (error) {
    console.error('PTY起動エラー:', error)
    throw error
  }
}
```

### 2.2 Rust

#### 基本ルール

```rust
// ✅ Good: Result型でエラーハンドリング
pub fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

// ✅ Good: 構造体のderive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}
```

#### Tauriコマンド

```rust
#[tauri::command]
pub fn spawn_pty(
    shell: String,
    cwd: String,
    app: AppHandle,
    manager: State<PtyManager>,
) -> Result<String, String> {
    // 実装
}
```

#### PTY関連の注意点

- PTY インスタンスは `Mutex<HashMap<String, PtyInstance>>` で管理する
- PTY出力の読み取りは `thread::spawn` で専用スレッドに分離する
- `slave` は `spawn_command` 後すぐに `drop` する（ファイルディスクリプタのリーク防止）

### 2.3 CSS / Tailwind

#### Tailwind CSS v4 の利用

Tailwind v4はCSSファーストのアプローチ。設定ファイル不要。

```css
/* src/index.css */
@import "tailwindcss";
```

```tsx
// ✅ Good: ユーティリティクラスを使用
<div className="flex items-center justify-between w-full h-full bg-[#1e1e1e]">

// カスタムCSS は Tailwindで表現できない場合のみ
```

#### カラーパレットの利用

色は `src/index.css` で定義した CSS カスタムプロパティを使用する。ハードコードした色を直接 Tailwind クラスに書かない。

```tsx
// ✅ Good: CSS カスタムプロパティを使用
<div className="bg-[var(--color-bg-panel)] border-[var(--color-border)]">

// ❌ Bad: 色をハードコード
<div className="bg-[#141414] border-[#2a2a2a]">
```

#### Radix UI プリミティブの利用

アクセシビリティが必要な UI 要素（タブ・ダイアログ・コンテキストメニュー等）は Radix UI のヘッドレスプリミティブをベースに実装する。

```tsx
// ✅ Good: Radix UI Tabs + Tailwind でスタイリング
import * as Tabs from '@radix-ui/react-tabs'

<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
  <Tabs.List className="flex h-9 border-b border-[var(--color-border)]">
    <Tabs.Trigger
      value="content"
      className="px-4 text-[var(--color-text-muted)] data-[state=active]:text-[var(--color-text-primary)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]"
    >
      コンテンツ
    </Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
```

#### アイコンの利用

アイコンは `lucide-react` を使用する。サイズは `size` props で指定する（`className` の `w-` / `h-` でも可）。

```tsx
import { FileText, Folder, Terminal } from 'lucide-react'

<Folder size={16} className="text-[var(--color-text-muted)]" />
```

---

## 3. コードレビュー手順

### 3.1 レビュー観点

#### 機能面
- [ ] 要件を満たしているか
- [ ] PTY管理のメモリリーク・ゾンビプロセスがないか
- [ ] Tauriイベントのリスナー解除が適切に行われているか

#### コード品質
- [ ] 命名が適切か（ユビキタス言語に沿っているか）
- [ ] Rustの `unwrap()` が適切なエラーハンドリングに置き換えられているか
- [ ] TypeScriptの `any` 型が使われていないか

#### パフォーマンス
- [ ] 大量ファイルのツリー表示で仮想スクロールが考慮されているか
- [ ] ファイル監視の除外設定（`node_modules`, `.git`）があるか

---

## 4. テスト戦略

### 4.1 テスト種類

| 種類 | ツール | 対象 |
|------|--------|------|
| Rustユニットテスト | `cargo test` | filesystem.rs, config.rs のロジック |
| Reactコンポーネントテスト | Vitest + Testing Library | 主要コンポーネント |
| E2Eテスト | `tauri-driver` | プロジェクト開く→ファイル表示→ターミナル起動の基本フロー |

### 4.2 Rustテスト例

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_dir_excludes_node_modules() {
        // node_modules が除外されることを確認
    }
}
```

### 4.3 React テスト例

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TerminalPanel } from '../TerminalPanel'

describe('TerminalPanel', () => {
  it('コンテナ要素がレンダリングされる', () => {
    const { container } = render(<TerminalPanel />)
    expect(container.firstChild).toBeTruthy()
  })
})
```

---

## 5. ドキュメント管理

### 5.1 ドキュメント種類

| 種類 | 場所 | 更新タイミング |
|------|------|--------------|
| プロダクト要件 | `docs/steering/01_product_requirements.md` | 要件変更時 |
| 機能設計 | `docs/steering/02_functional_design.md` | 機能追加・変更時 |
| 技術仕様 | `docs/steering/03_architecture_specifications.md` | アーキテクチャ変更時 |
| リポジトリ構造 | `docs/steering/04_repository_structure.md` | 構造変更時 |
| 開発ガイドライン | `docs/steering/05_development_guidelines.md` | ルール変更時 |
| ユビキタス言語 | `docs/steering/06_ubiquitous_language.md` | 用語追加・変更時 |
| CLAUDE.md | ルート | プロジェクト構成変更時 |
| 作業ドキュメント | `docs/working/{YYYYMMDD}_{要件名}/` | 各開発タスク開始時 |

### 5.2 作業ドキュメント

新規機能開発時は `generate-working-docs` スキルを使用して以下を生成する：
- `requirements.md` - 要件定義書
- `design.md` - 設計書
- `tasklist.md` - タスクリスト
- `testing.md` - テスト手順書

---

## 6. Git運用ルール

### 6.1 コミット粒度

- 1コミット = 1つの論理的な変更
- 動作する状態でコミット
- WBSのタスクIDをコミットメッセージに含めると追跡しやすい

### 6.2 PR作成ルール

- `feature/*` → `develop`: PR作成 → CIパス → マージ
- `develop` → `main`: 動作確認済みのタイミングでPRマージ
- 各Issueに対応するfeatureブランチを切り、PRで `Closes #<issue番号>` を記載

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-03-28 | 1.0 | 初版作成 | - |
