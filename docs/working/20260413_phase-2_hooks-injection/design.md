# 設計書 - Phase 2: OSC 9 検出による通知トリガー

## アーキテクチャ

### 対象コンポーネント

```
spawn_pty (Rust)
    │ env: TERM_PROGRAM=iTerm.app
    ▼
Claude Code (ターミナル内で動作)
    │ OSC 9 エスケープシーケンスを出力
    │ ESC ] 9 ; <message> BEL
    ▼
PTY 出力リーダースレッド (pty.rs)
    │ バイト列をスキャンして OSC 9 を検出
    │ メッセージを抽出
    ▼
notification.rs (Phase 1 で実装済み)
    │ フォーカス判定 → send_native_notification
    ▼
macOS 通知
```

### 影響範囲

- **フロントエンド**: 変更なし
- **バックエンド（Rust）**: `pty.rs` のリーダースレッドに OSC 9 検出を追加

## 実装方針

### 概要

PTY 出力のリーダースレッド（既存）でバイト列を読み取る際に、OSC 9 シーケンスをスキャンする。検出したメッセージは Phase 1 の `send_native_notification` に渡す。OSC 9 のバイト列はそのまま alacritty-terminal に渡され、通常のターミナル処理は妨げない。

### OSC 9 フォーマット

```
ESC ] 9 ; <message> BEL
\x1b  ]  9  ;  ...    \x07

または ST 終端:
ESC ] 9 ; <message> ESC \
\x1b  ]  9  ;  ...    \x1b  \
```

### OSC 9 検出のステートマシン

```rust
enum Osc9State {
    Normal,          // 通常
    Esc,             // ESC を検出
    OscStart,        // ESC ] を検出
    Osc9Semi,        // ESC ] 9 ; を検出 → メッセージ蓄積中
}
```

バイトごとにステートを遷移し、BEL (`\x07`) または ESC `\` で OSC 9 の完了を検出する。

## データ構造

### OSC 9 パーサー（Rust）

```rust
pub struct Osc9Detector {
    state: Osc9State,
    buffer: Vec<u8>,
}

impl Osc9Detector {
    pub fn new() -> Self { ... }

    /// バイト列をスキャンし、OSC 9 メッセージを検出したら返す。
    /// 複数の OSC 9 が含まれる場合は Vec で返す。
    pub fn feed(&mut self, data: &[u8]) -> Vec<String> { ... }
}
```

## pty.rs の変更

### TERM_PROGRAM 環境変数

```rust
// spawn_pty 内
cmd.env("TERM_PROGRAM", "iTerm.app");
```

### リーダースレッドへの OSC 9 検出追加

```rust
// 既存のリーダースレッド内
let mut osc9 = Osc9Detector::new();

loop {
    match reader.read(&mut buf) {
        Ok(0) => break,
        Ok(n) => {
            // OSC 9 検出
            for msg in osc9.feed(&buf[..n]) {
                if !is_app_focused(&app) {
                    send_native_notification(&app, "SpecPrompt / Claude Code", &msg);
                }
            }

            // 既存の処理（xterm.js + alacritty-terminal）
            // ...
        }
        Err(_) => break,
    }
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| OSC 9 方式 | ゼロセットアップ、ラッパー不要、Claude Code 組み込み機能を活用 | hooks + ラッパー（検証で問題が発生、複雑） |
| `TERM_PROGRAM=iTerm.app` | Claude Code の Auto モードで OSC 9 を出力させるため | ユーザーに `/config` 変更を要求（手動設定が必要） |
| バイト単位のステートマシン | PTY 出力はチャンク分割されるため、バッファ境界をまたぐ OSC 9 にも対応 | 正規表現（チャンク分割に弱い） |

## 未解決事項

- [ ] `TERM_PROGRAM=iTerm.app` が他のツール（vim, tmux 等）に影響しないか確認
