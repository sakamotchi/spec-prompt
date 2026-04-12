# 設計書 - alacritty-terminal Phase 1（Rust側実装）

## アーキテクチャ

### 対象コンポーネント

```
PTY（portable-pty）
    ↓ バイト列
alacritty-terminal::Term  ← 新規（terminal/ モジュール）
    ↓ CellData[]
Tauri イベント "terminal-cells"（新規）
    ↓
WebView（Phase 2 で接続）

※ 既存の "pty-output" イベントは並行して維持する
```

### 影響範囲

- **バックエンド（Rust）**: `terminal/` モジュール新規追加、`commands/pty.rs` 改修、`lib.rs` 登録追加
- **フロントエンド**: Phase 1 では変更なし（`pty-output` イベントは維持するため xterm.js は動作し続ける）

---

## 実装方針

### 概要

既存の PTY 読み取りスレッド内で `TerminalInstance.advance()` を呼び出し、変更されたセルを `terminal-cells` イベントで emit する。`TerminalManager`（新規）を AppState に追加し、`PtyManager`（既存）と並行して動作させる。

### 詳細

1. `alacritty-terminal` を Cargo.toml に追加（バージョンピン留め）
2. `terminal/` モジュールを作成し、`TerminalInstance` / `TermEventHandler` / `CellData` を実装
3. `TerminalManager` を `lib.rs` の AppState に追加
4. `spawn_pty` で `TerminalInstance` を生成・登録し、PTY 読み取りスレッドで `advance` → `emit` を追加
5. `resize_terminal` コマンドを新規追加（既存 `resize_pty` を内部で呼び出す）

---

## データ構造

### 型定義（Rust）

```rust
// src-tauri/src/terminal/grid.rs

#[derive(Debug, Clone, serde::Serialize)]
pub struct CellData {
    pub row: u16,
    pub col: u16,
    pub ch: char,
    pub wide: bool,      // true: 全角（Flags::WIDE_CHAR）, false: 半角
                         // Flags::WIDE_CHAR_SPACER のセルは変換せず送信をスキップする
    pub fg: ColorData,
    pub bg: ColorData,
    pub flags: CellFlags,
}

// alacritty_terminal の Color enum に対応（T-1 調査で確認）:
//   Color::Named(NamedColor) → ColorData::Named(u8 as index)
//   Color::Indexed(u8)       → ColorData::Indexed(u8)
//   Color::Spec(Rgb)         → ColorData::Rgb { r, g, b }
//   ※ デフォルト色は Named(NamedColor::Foreground/Background) で表現される
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "value")]
pub enum ColorData {
    Named(u8),                       // ANSI 16色（NamedColor as u8）
    Indexed(u8),                     // xterm 256色
    Rgb { r: u8, g: u8, b: u8 },
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CellFlags {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikeout: bool,
    pub blink: bool,
    pub inverse: bool,
    pub dim: bool,
}
```

```rust
// src-tauri/src/terminal/instance.rs

pub struct TerminalInstance {
    pub term: alacritty_terminal::Term<TermEventHandler>,
    pub pty_id: String,
}
```

### IPC イベントペイロード（Rust → WebView）

```rust
// src-tauri/src/terminal/mod.rs

#[derive(serde::Serialize, Clone)]
pub struct TerminalCellsPayload {
    pub id: String,
    pub cells: Vec<CellData>,
    pub cursor: CursorPos,
}

#[derive(serde::Serialize, Clone)]
pub struct CursorPos {
    pub row: u16,
    pub col: u16,
}
```

---

## API設計

### Tauri コマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `resize_terminal` | `id: String, cols: u16, rows: u16` | `Result<(), String>` | Term と PTY 両方をリサイズ |

※ `spawn_pty` / `write_pty` / `close_pty` は既存コマンドを継続使用（シグネチャ変更なし）

### Tauri イベント

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `terminal-cells`（新規） | `TerminalCellsPayload` | セルグリッド差分。PTY 出力処理後に emit |
| `pty-output`（既存・維持） | `PtyOutput { id, data }` | 生バイト列。xterm.js との並行動作のため維持 |

---

## モジュール設計

### ディレクトリ構成

```
src-tauri/src/
├── commands/
│   ├── mod.rs
│   ├── pty.rs          既存（spawn_pty 内部で TerminalManager を呼び出すよう改修）
│   ├── config.rs       既存（変更なし）
│   ├── filesystem.rs   既存（変更なし）
│   └── fonts.rs        既存（変更なし）
├── terminal/           新規
│   ├── mod.rs          TerminalManager, TerminalCellsPayload, CursorPos
│   ├── instance.rs     TerminalInstance
│   ├── event.rs        TermEventHandler（EventListener 実装）
│   └── grid.rs         CellData, ColorData, CellFlags, extract_dirty_cells()
├── lib.rs              TerminalManager を manage() に追加
└── main.rs             変更なし
```

### TerminalManager

```rust
// src-tauri/src/terminal/mod.rs

pub struct TerminalManager {
    instances: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self { instances: Mutex::new(HashMap::new()) }
    }

    pub fn insert(&self, id: String, instance: TerminalInstance) { ... }
    pub fn remove(&self, id: &str) { ... }

    /// 指定 id の Term に bytes を advance し、damage セルを収集して返す
    /// 内部フロー: process(bytes) → damage() → collect cells → reset_damage()
    pub fn advance_and_collect(&self, id: &str, bytes: &[u8]) -> Option<TerminalCellsPayload> { ... }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) { ... }
}
```

### spawn_pty の改修方針

既存の `spawn_pty` に `TerminalManager` の `State` を追加し、`TerminalInstance` の生成・登録と PTY 読み取りスレッド内での `advance` 呼び出しを追加する。

```rust
// 改修イメージ（抜粋）
#[tauri::command]
pub fn spawn_pty(
    shell: String,
    cwd: String,
    app: AppHandle,
    pty_manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,  // 追加
) -> Result<String, String> {
    // ... 既存の PTY 生成処理 ...

    // TerminalInstance を生成・登録
    let instance = TerminalInstance::new(80, 24, id.clone());
    terminal_manager.insert(id.clone(), instance);

    // PTY 読み取りスレッド（改修）
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();

                    // 既存: xterm.js 向け生バイト列イベント（維持）
                    let _ = app.emit("pty-output", PtyOutput { id: pty_id.clone(), data });

                    // 新規: alacritty-terminal で処理してセルグリッドを送信
                    if let Some(payload) = terminal_manager.advance_and_collect(&pty_id, &buf[..n]) {
                        let _ = app.emit("terminal-cells", payload);
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(id)
}
```

---

## テストコード

### Rust テスト例

```rust
// src-tauri/src/terminal/grid.rs のテスト

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_data_serialize() {
        let cell = CellData {
            row: 0, col: 0,
            ch: 'A',
            wide: false,
            fg: ColorData::Named(7),   // Default は Named(NamedColor::Foreground=7 相当)
            bg: ColorData::Named(0),
            flags: CellFlags { bold: false, italic: false, underline: false,
                               strikeout: false, blink: false, inverse: false, dim: false },
        };
        let json = serde_json::to_string(&cell).unwrap();
        assert!(json.contains("\"ch\":\"A\""));
    }

    #[test]
    fn test_color_data_named_serialize() {
        let color = ColorData::Named(1);
        let json = serde_json::to_string(&color).unwrap();
        assert_eq!(json, r#"{"type":"Named","value":1}"#);
    }
}
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `PtyManager` と `TerminalManager` を分離する | 既存コードへの影響を最小限にする。将来の廃止・入れ替えも容易 | 既存 PtyManager に Term を追加（影響範囲が大きい） |
| `pty-output` イベントを Phase 1 で維持する | Phase 2 完了まで xterm.js を並行動作させるため | 即時廃止（xterm.js が壊れ開発が止まる） |
| dirty cells のみ送信する | 全画面送信（80×24 = 1920 セル）は毎フレーム送ると重い | 全画面送信（実装は簡単だが非効率） |
| `Term<T>` を `Mutex` で管理する | `Term` は `Send` 非対応のため | `Arc<RwLock<>>` （オーバースペック） |

## 未解決事項

- [x] ~~`alacritty-terminal` の "dirty" セル取得 API の確認~~ → `Term::damage()` / `Term::reset_damage()` で確認済み（T-1）
- [x] ~~`alacritty-terminal` の最新安定バージョンの確認~~ → `0.25.1`（T-1 調査済み）
- [ ] `TermDamage::Partial` の `LineDamageBounds` から `renderable_content().display_iter` で対象行セルを絞り込む実装詳細（実装時に確認）
- [ ] `Color::Named(NamedColor)` の `NamedColor as u8` 変換が全バリアントで意図通りか確認
