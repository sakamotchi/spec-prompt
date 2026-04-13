# 設計書 - Phase 3: 設定 UI + 仕上げ

## アーキテクチャ

### 対象コンポーネント

```
Settings.tsx (トグル UI)
    ↓ setNotificationEnabled()
appStore.ts (Zustand + persist)
    ↓ invoke('spawn_pty', { notificationEnabled })
pty.rs
    ↓ 環境変数の設定 / 非設定
PTY プロセス
```

### 影響範囲

- **フロントエンド**: appStore, Settings.tsx
- **バックエンド（Rust）**: pty.rs（環境変数設定の条件分岐）

## 実装方針

### 概要

フロントエンドの `appStore` に `notificationEnabled` を追加し、persist で永続化する。設定画面にトグルを追加する。`spawn_pty` 呼び出し時に設定値を引数として渡し、Rust 側で環境変数の設定を制御する。

### 設定値の受け渡し方式

`spawn_pty` の引数に `notification_enabled: bool` を追加する。フロントエンドから `invoke('spawn_pty', { shell, cwd, notificationEnabled: true })` で呼び出す。

## 状態管理

### Zustand ストア変更

```typescript
// appStore.ts への追加
interface AppState {
  // ... 既存フィールド
  notificationEnabled: boolean
  setNotificationEnabled: (v: boolean) => void
}

// persist の partialize に notificationEnabled を含める
```

## UI 設計

### カラーパレット

既存の CSS カスタムプロパティを使用:
- `--color-bg-elevated` — トグルの背景
- `--color-border` — ボーダー
- `--color-text-primary` — ラベル
- `--color-accent` — ON 状態のトグル色

### コンポーネント

```typescript
// Settings.tsx 内の通知トグルセクション
<div className="flex items-center justify-between">
  <label>Claude Code 通知</label>
  <ToggleSwitch
    checked={notificationEnabled}
    onChange={setNotificationEnabled}
  />
</div>
```

## API 変更

### spawn_pty の引数追加

```rust
#[tauri::command]
pub fn spawn_pty(
    shell: String,
    cwd: String,
    notification_enabled: bool,  // 追加
    // ...
) -> Result<String, String> {
    // ...
    // OSC 方式: notification_enabled が true の場合のみ TERM_PROGRAM を設定
    if notification_enabled {
        cmd.env("TERM_PROGRAM", "iTerm.app");
    }
    // ...
}
```

OSC 9 検出はリーダースレッド側で常に動作するが、`TERM_PROGRAM` が未設定だと Claude Code が OSC 9 を出力しないため、実質的に通知が無効化される。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| 設定変更は次回 PTY 起動から反映 | 既存ターミナルの環境変数は変更不可 | ターミナルを強制再起動（UX が悪い） |
| `spawn_pty` の引数で渡す | Rust 側で状態管理しない（フロントエンドが信頼できるソース） | Tauri state で共有（複雑化） |
| OFF 時は TERM_PROGRAM を設定しない | OSC 9 が出力されないため検出もされない（シンプル） | リーダースレッドで検出を無効化（フラグ管理が複雑） |

## 未解決事項

- [ ] 既存の `spawn_pty` 呼び出し元すべてに `notification_enabled` 引数を追加する必要がある
