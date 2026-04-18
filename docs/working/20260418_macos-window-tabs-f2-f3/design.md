# 設計書 - macos-window-tabs-f2-f3

F2（`⌘N` + メニュー）と F3（persist キー分離）の実装設計。全体設計の原典は `docs/local/20260418-macOSウィンドウタブ統合/02_概要設計書.md`。

## アーキテクチャ

### 対象コンポーネント

```
[F2 経路①: キーボード]
  ユーザー押下 ⌘N
    ↓
  AppLayout.tsx keydown handler
    ↓
  tauriApi.openNewWindow()  ← F1 で tabbingIdentifier 付与済み
    ↓
  new WebviewWindow(label, { ..., tabbingIdentifier: 'SpecPrompt' })

[F2 経路②: メニュー]
  ユーザー: File > New Window クリック
    ↓
  Rust: MenuItem の on_event で emit("menu-new-window")
    ↓
  Frontend: window.listen("menu-new-window") → tauriApi.openNewWindow()

[F3: localStorage 名前空間分離]
  モジュール初期化時
    ↓
  const label = getCurrentWindow().label  // "main" or "window-..."
    ↓
  persist(..., { name: `spec-prompt-app-store:${label}` })
    ↓
  localStorage キーがウィンドウごとに独立
```

### 影響範囲

- **フロントエンド**: `AppLayout.tsx` にショートカット＆イベント購読、`appStore.ts` に persist 名変更＋マイグレーション、i18n とショートカット一覧更新
- **バックエンド（Rust）**: `lib.rs` にメニュー構築 + イベント emit

## 実装方針

### F2: `⌘N` / メニュー

#### F2-1: `AppLayout.tsx` のグローバル keydown 拡張（後に取り下げ）

**実装時の判断（2026-04-18）**: 当初 JS 側にも `⌘N` keydown ハンドラを追加したが、**macOS の menu accelerator とダブルで発火して 1 回の押下で 2 ウィンドウが同じ位置に同時生成される**バグが発覚。menu accelerator は webview keydown より先（AppKit レベル）で捕捉されるため、JS 側のハンドラは冗長かつ有害。

**最終方針**: JS 側の `⌘N` ハンドラは実装しない。`File > New Window` の menu accelerator（`CmdOrCtrl+N`）に一本化する。パレット表示中の抑止は menu accelerator が webview から独立して発火するため webview 側の stop 手段では効かず、「パレット表示中でも `⌘N` で新規ウィンドウが開く」macOS 標準挙動を受け入れる。

以下の素案は参考として残すが**実装しない**：

```typescript
// src/components/Layout/AppLayout.tsx
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    // 既存の分岐 ...

    // ⌘N / Ctrl+N: 新規ウィンドウ
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.shiftKey && !e.altKey &&
      (e.key === 'n' || e.key === 'N')
    ) {
      // モーダル表示中は抑止（既存パターンに合わせる）
      if (usePromptPaletteStore.getState().isOpen) return
      // PathPalette 開中も同様に抑止する場合は条件追加
      e.preventDefault()
      tauriApi.openNewWindow()
      return
    }

    // 既存の分岐 ...
  }
  window.addEventListener('keydown', onKeyDown, true)
  return () => window.removeEventListener('keydown', onKeyDown, true)
}, [])
```

#### F2-2: Tauri メニュー構築（Rust）

`src-tauri/src/lib.rs` の `setup` hook でメニューを構築する：

```rust
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

// setup hook 内
let app_handle = app.handle().clone();

#[cfg(target_os = "macos")]
let app_submenu = SubmenuBuilder::new(&app_handle, "SpecPrompt")
    .about(None)
    .separator()
    .services()
    .separator()
    .hide()
    .hide_others()
    .show_all()
    .separator()
    .quit()
    .build()?;

let new_window_item = MenuItemBuilder::new("New Window")
    .id("new-window")
    .accelerator("CmdOrCtrl+N")
    .build(&app_handle)?;

let file_submenu = SubmenuBuilder::new(&app_handle, "File")
    .item(&new_window_item)
    .separator()
    .close_window()
    .build()?;

let edit_submenu = SubmenuBuilder::new(&app_handle, "Edit")
    .undo()
    .redo()
    .separator()
    .cut()
    .copy()
    .paste()
    .select_all()
    .build()?;

let window_submenu = SubmenuBuilder::new(&app_handle, "Window")
    .minimize()
    .maximize()
    .separator()
    .close_window()
    .build()?;

let menu_builder = MenuBuilder::new(&app_handle);
#[cfg(target_os = "macos")]
let menu_builder = menu_builder.item(&app_submenu);
let menu = menu_builder
    .item(&file_submenu)
    .item(&edit_submenu)
    .item(&window_submenu)
    .build()?;

app.set_menu(menu)?;

app.on_menu_event(move |app, event| {
    if event.id() == "new-window" {
        let _ = app.emit("menu-new-window", ());
    }
});
```

フロント側では `AppLayout.tsx` でこのイベントを購読：

```typescript
// src/components/Layout/AppLayout.tsx
useEffect(() => {
  let unlisten: (() => void) | undefined
  listen('menu-new-window', () => tauriApi.openNewWindow())
    .then((fn) => { unlisten = fn })
  return () => unlisten?.()
}, [])
```

**簡易版（F2-2 を省略する場合）**: メニュー無しで F2-1 のショートカットのみでリリース。この場合 Rust 側変更なし。F2-2 の工数を削るなら tasklist で調整。

#### F2-3: i18n

```jsonc
// ja.json
{
  "menu": {
    "file": {
      "label": "ファイル",
      "newWindow": "新規ウィンドウ"
    }
  }
}

// en.json
{
  "menu": {
    "file": {
      "label": "File",
      "newWindow": "New Window"
    }
  }
}
```

Tauri メニューは Rust 側で構築するため、ja/en のラベルを `setup` hook で切り替えるには `tauri_plugin_localhost` 的な仕組みが必要。簡易対応として **メニュー表記は英語固定**（macOS 標準アプリも英語/日本語混在）、ショートカット一覧モーダル内のラベルのみ i18n 対応、とするのが現実的。

### F3: persist キー分離

#### F3-1: `appStore.ts` の修正

```typescript
// src/stores/appStore.ts
import { getCurrentWindow } from '@tauri-apps/api/window'

const WINDOW_LABEL = getCurrentWindow().label
const PERSIST_KEY = `spec-prompt-app-store:${WINDOW_LABEL}`

// F3-2: マイグレーション
if (WINDOW_LABEL === 'main') {
  const oldKey = 'spec-prompt-app-store'
  const oldValue = localStorage.getItem(oldKey)
  if (oldValue !== null && localStorage.getItem(PERSIST_KEY) === null) {
    localStorage.setItem(PERSIST_KEY, oldValue)
    localStorage.removeItem(oldKey)
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: PERSIST_KEY,
      partialize: /* 既存のまま */,
      storage: /* 既存のまま */,
    }
  )
)
```

**注意**: `getCurrentWindow().label` は同期取得可能な API（v2）。jsdom 環境（vitest）ではモックが必要。

#### F3-3: PTY ID 実装確認

`src-tauri/src/commands/pty.rs` を読み、`spawn_pty` の ID 発行が `uuid::Uuid::new_v4()` 等でグローバル一意か確認する。一意なら変更不要。

## データ構造

### 型定義（TypeScript）

F3 では既存 `AppState` の型は変更なし。persist キーが動的化されるだけ。

### 設定・定義（Rust）

```rust
// src-tauri/src/lib.rs のメニュー構築部分（抜粋、上記 F2-2 参照）
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
```

## API設計

### Tauriコマンド

F2+F3 では新規追加なし。既存 `openNewWindow` を流用。

### Tauriイベント

| イベント名 | ペイロード | 送信元 | 受信側 | 説明 |
|-----------|-----------|-------|-------|------|
| `menu-new-window` | `()` | Rust（Menu イベント） | Frontend `AppLayout.tsx` | File > New Window メニュー選択時 |

## UI設計

F2+F3 では新規 UI コンポーネントなし。

### ショートカット一覧モーダル

`src/lib/shortcuts.ts` にエントリ追加：

```typescript
{
  id: 'newWindow',
  keys: { mac: '⌘N', other: 'Ctrl+N' },
  descriptionKey: 'shortcuts.newWindow',
}
```

`src/i18n/locales/*.json` に `shortcuts.newWindow` = "新規ウィンドウを開く" / "Open a new window" を追加。

## 状態管理

### Zustandストア変更

**`appStore.ts`**: persist `name` を `` `spec-prompt-app-store:${label}` `` に動的化 + 旧キーから main への 1 回限りマイグレーション。

**`contentStore.ts` / `terminalStore.ts`**: persist 不使用のため変更なし（状態はウィンドウローカルでメモリ保持）。

**`settingsStore.ts`**: 言語設定 `spec-prompt-language` はユーザー横断共有のまま維持（変更なし）。

**`promptPaletteStore.ts`**: persist 不使用のため変更なし。

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/stores/appStore.test.ts（既存テストに追記）
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'main' }),
}))

beforeEach(() => {
  localStorage.clear()
})

describe('appStore persist key (F3)', () => {
  it('persist キーがウィンドウラベル付きである', async () => {
    const { useAppStore } = await import('./appStore')
    useAppStore.getState().setActiveMainTab('terminal')
    expect(localStorage.getItem('spec-prompt-app-store:main')).not.toBeNull()
  })

  it('旧キーから main キーへマイグレーションする', async () => {
    const oldValue = JSON.stringify({ state: { activeMainTab: 'terminal' }, version: 0 })
    localStorage.setItem('spec-prompt-app-store', oldValue)
    vi.resetModules()
    await import('./appStore')
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBe(oldValue)
    expect(localStorage.getItem('spec-prompt-app-store')).toBeNull()
  })

  it('既に main キーが存在する場合は上書きしない', async () => {
    localStorage.setItem('spec-prompt-app-store', '{"old":true}')
    localStorage.setItem('spec-prompt-app-store:main', '{"new":true}')
    vi.resetModules()
    await import('./appStore')
    expect(localStorage.getItem('spec-prompt-app-store:main')).toBe('{"new":true}')
  })
})
```

### AppLayout keydown テスト（任意）

`AppLayout.tsx` の keydown リスナは既存の `Cmd+Shift+P` テストと同パターンで追加可能。工数とリターンを見て判断。

### Rustテスト

メニュー構築は実行時確認に頼るのが現実的（unit test しにくい）。F2+F3 では Rust 側 unit test を新規追加しない。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| F2 と F3 を同一 PR | F2 単独リリースだと新規ウィンドウ導線が増え、localStorage 共有のまま状態混線が起きるため | 別 PR（却下、順序依存で問題） |
| メニュー表記は英語固定（F2-3） | Tauri v2 の Menu API は Rust 側で静的構築のため i18n 動的切替が困難。macOS の他アプリも Mixed language のケース多数 | フロント側でメニューを再構築して言語切替連動（実装コスト大、v1.1 候補） |
| マイグレーション（F3-2）を F2+F3 PR に含める | ユーザーの状態保全は UX 上重要。コストが低い（10 行程度） | v1.1 に先送り（却下） |
| `contentStore` / `terminalStore` に persist を入れない | 現状は揮発性で問題なく動作しており、スコープ外。ウィンドウ固有状態はローカル state で足りる | persist 化（却下、スコープ肥大化） |
| `settingsStore` の言語は共有維持 | ユーザー環境依存の設定は全ウィンドウで一貫しているべき | ウィンドウ別言語（却下、非実用的） |
| keydown リスナは capture フェーズ | 既存の `Cmd+Shift+P` 等と同じパターン（`AppLayout` のリスナを先に実行） | bubbling（却下、既存パターン不一致） |
| `⌘N` は textarea / input でも発火する | SpecPrompt は読み取り専用アプリで編集可能な input がほぼない。検索バーや rename 時の input は `⌘N` を使わない | input 時は preventDefault しない（実装コスト対効果で却下、必要なら tasklist で判断） |

## 未解決事項

- [ ] Tauri Menu API の正確な import（`tauri::menu::MenuBuilder` vs `tauri::Menu::new`）は v2.10 のドキュメントを着手時に再確認
- [ ] `setup` hook で `app.set_menu()` を呼ぶタイミング（ウィンドウ生成前後どちらか）
- [ ] ショートカット一覧モーダル（`shortcuts.ts`）の既存エントリ形式に合わせて追加する（着手時に `shortcuts.ts` の現行構造を確認）
- [ ] `AppLayout.tsx` の既存 keydown リスナの実装箇所と整合性（1 つの useEffect に集約されているか、個別リスナか）
