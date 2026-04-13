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
    app: AppHandle,
    manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,
) -> Result<String, String> {
    // ...
    if notification_enabled {
        if let Ok(home) = std::env::var("HOME") {
            let wrapper_dir = format!("{}/.config/spec-prompt/bin", home);
            if std::path::Path::new(&wrapper_dir).exists() {
                // PATH の先頭にラッパーを追加
                path = format!("{}:{}", wrapper_dir, path);
                cmd.env("SPEC_PROMPT_NOTIFICATION", "1");
            }
        }
    }
    cmd.env("PATH", path);
    // ...
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| 設定変更は次回 PTY 起動から反映 | 既存ターミナルの環境変数は変更不可 | ターミナルを強制再起動（UX が悪い） |
| `spawn_pty` の引数で渡す | Rust 側で状態管理しない（フロントエンドが信頼できるソース） | Tauri state で共有（複雑化） |

## 未解決事項

- [ ] 既存の `spawn_pty` 呼び出し元すべてに `notification_enabled` 引数を追加する必要がある
