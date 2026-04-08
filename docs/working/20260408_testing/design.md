# 設計書 - Phase 4-B: テスト整備

## アーキテクチャ

### テスト構成図

```
テストスイート
├── フロントエンド（Vitest + jsdom）
│   ├── src/lib/*.test.ts        — ユーティリティ単体テスト
│   ├── src/stores/*.test.ts     — Zustand ストアテスト
│   └── src/components/**/*.test.tsx — コンポーネントテスト
│
└── バックエンド（cargo test）
    └── src-tauri/src/commands/*.rs — Rust ユニットテスト（インラインモジュール）
```

### 影響範囲

- **フロントエンド**: テストファイルの追加のみ。本体コードは変更しない
- **バックエンド（Rust）**: `pty.rs` にテスト関数を追加

---

## 実装方針

### 概要

既存のテストインフラ（Vitest + Testing Library + jsdom）をそのまま活用し、テストファイルのみ追加する。Rust 側も既存の `#[cfg(test)]` モジュールに追記する形で対応する。

### 詳細

1. **ユーティリティテスト** (`frontmatter.test.ts`, `windowSession.test.ts`) — 純粋関数のテストは Tauri API への依存がないため容易。`windowSession.ts` の localStorage 操作は jsdom が提供する `localStorage` をそのまま使用できる。
2. **ストアテスト** — 既存のパターン（`beforeEach` でリセット）を踏襲する。
3. **コンポーネントテスト** — Tauri IPC に依存するコンポーネント（`TerminalPanel`、`TreePanel` 等）はモックが複雑なためスコープ外とし、IPC 非依存の `ContentView`・`InlineInput` を対象とする。
4. **Rust テスト** — `pty.rs` の `~` 展開ロジックはシェルや PTY に依存しない純粋な文字列操作であるため、単体テスト可能。

---

## テストパターン

### ユーティリティテスト（TypeScript）

```typescript
// src/lib/frontmatter.test.ts
import { describe, it, expect } from 'vitest'
import { parseStatus, setStatus } from './frontmatter'

describe('parseStatus', () => {
  it('フロントマターに status: draft があれば draft を返す', () => {
    const content = '---\nstatus: draft\n---\n# Title'
    expect(parseStatus(content)).toBe('draft')
  })

  it('フロントマターがなければ null を返す', () => {
    expect(parseStatus('# Title\nno frontmatter')).toBeNull()
  })
})
```

### localStorage を使ったテスト（windowSession）

jsdom は `localStorage` を提供するため、モック不要。ただし各テスト後にクリアが必要。

```typescript
// src/lib/windowSession.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveMySession, loadWindowSessions, consolidateAndSave, clearWindowSessions } from './windowSession'

describe('windowSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveMySession でキーが書き込まれる', () => {
    saveMySession('window-abc', '/path/to/project')
    expect(localStorage.getItem('specprompt-win-window-abc')).not.toBeNull()
  })
})
```

### コンポーネントテスト（React Testing Library）

Tauri IPC に依存するコンポーネントはモック設定が必要。`vi.mock` で `@tauri-apps/api/core` をスタブする。

```typescript
// src/components/ContentView/ContentView.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ContentView } from './ContentView'
import { useContentStore } from '../../stores/contentStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(''),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
```

### Rust ユニットテスト

既存の `#[cfg(test)] mod tests { ... }` ブロックに追記する。

```rust
// src-tauri/src/commands/pty.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tilde_expansion() {
        let home = std::env::var("HOME").unwrap_or_default();
        // resolve_cwd は仮のヘルパー関数（実装時に抽出）
        assert!(resolve_cwd("~").starts_with(&home));
        assert_eq!(resolve_cwd("/absolute/path"), "/absolute/path");
    }
}
```

---

## データ構造

### テスト用ファイル構成

```
src/
├── lib/
│   ├── frontmatter.test.ts       （新規）
│   └── windowSession.test.ts     （新規）
└── components/
    ├── ContentView/
    │   └── ContentView.test.tsx  （新規）
    └── TreePanel/
        └── InlineInput.test.tsx  （新規）

src-tauri/src/commands/
└── pty.rs                        （既存ファイルにテスト追記）
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `@tauri-apps/api/*` を `vi.mock` でスタブ | jsdom 環境では Tauri IPC が使えない。全コンポーネントを対象にするより IPC 非依存のものを優先する方がリターンが大きい | tauri-driver で E2E テスト（工数大、CI 環境整備が必要） |
| `react-i18next` を `vi.mock` でスタブ | i18next の初期化がテスト環境で複雑になるため、`t = (key) => key` で代替 | i18n テスト設定を全テストに共有（オーバーエンジニアリング） |
| `pty.rs` のチルダ展開ロジックをヘルパー関数に抽出してテスト | `spawn_pty` 全体は PTY プロセス生成が必要でテスト不可。純粋なロジック部分だけ切り出す | 統合テスト（CI 環境でのみ実行、セットアップ複雑） |
| E2E（tauri-driver）は対象外 | tauri-driver は専用のビルドと WebDriver の設定が必要で工数が大きい。現フェーズでは Vitest + cargo test の整備を優先する | E2E を含む（4-B-3 の別タスクとして将来対応） |

## 未解決事項

- [ ] E2E テスト（4-B-3）の具体的な実施タイミング — tauri-driver の macOS 対応状況を調査してから判断する
