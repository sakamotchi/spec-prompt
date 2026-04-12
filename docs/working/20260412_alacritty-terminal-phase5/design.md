# 設計書 - alacritty-terminal Phase 5（テスト・品質）

## アーキテクチャ

### 対象コンポーネント

Phase 5 は新機能の実装ではなく、品質確認とテスト追加が主体。

```
Rust テスト追加
  ├── terminal/grid.rs      ← color_to_data / flags_to_cell_flags のユニットテスト拡充
  └── terminal/instance.rs  ← TerminalInstance の統合テスト追加

手動確認
  ├── Claude Code 起動 → CJK・ボックス描画文字・絵文字の描画確認
  ├── リサイズ → ウィンドウ・分割レイアウト切り替えの安定性
  ├── フォント変更 → Canvas 再描画・PTY リサイズ
  └── パフォーマンス → yes コマンド負荷テスト
```

### 影響範囲

- **Rust**: `terminal/grid.rs`（テスト追加のみ）、`terminal/instance.rs`（テスト追加のみ）
- **フロントエンド**: 変更なし（手動確認のみ）

---

## 5-E: Rust テスト設計

### grid.rs テスト

#### color_to_data テスト

```rust
#[test]
fn test_color_to_data_named_0_to_15() {
    // ANSI 16色（0〜15）→ ColorData::Named(0..15)
    for i in 0..16u8 {
        let color = Color::Named(unsafe { std::mem::transmute(i) });
        match color_to_data(color) {
            ColorData::Named(v) => assert_eq!(v, i),
            other => panic!("Expected Named({i}), got {:?}", other),
        }
    }
}

#[test]
fn test_color_to_data_named_foreground_background() {
    // NamedColor::Foreground(256), Background(257) 等 → ColorData::Default
    use alacritty_terminal::vte::ansi::NamedColor;
    assert!(matches!(
        color_to_data(Color::Named(NamedColor::Foreground)),
        ColorData::Default
    ));
    assert!(matches!(
        color_to_data(Color::Named(NamedColor::Background)),
        ColorData::Default
    ));
}

#[test]
fn test_color_to_data_indexed() {
    assert!(matches!(
        color_to_data(Color::Indexed(128)),
        ColorData::Indexed(128)
    ));
}

#[test]
fn test_color_to_data_rgb() {
    use alacritty_terminal::vte::ansi::Rgb;
    let color = Color::Spec(Rgb { r: 255, g: 128, b: 0 });
    match color_to_data(color) {
        ColorData::Rgb { r, g, b } => {
            assert_eq!(r, 255);
            assert_eq!(g, 128);
            assert_eq!(b, 0);
        }
        other => panic!("Expected Rgb, got {:?}", other),
    }
}
```

#### flags_to_cell_flags テスト

```rust
#[test]
fn test_flags_empty() {
    let flags = flags_to_cell_flags(Flags::empty());
    assert!(!flags.bold);
    assert!(!flags.italic);
    assert!(!flags.underline);
    assert!(!flags.strikeout);
    assert!(!flags.inverse);
    assert!(!flags.dim);
}

#[test]
fn test_flags_all_set() {
    let flags = flags_to_cell_flags(
        Flags::BOLD | Flags::ITALIC | Flags::UNDERLINE | Flags::STRIKEOUT | Flags::INVERSE | Flags::DIM
    );
    assert!(flags.bold);
    assert!(flags.italic);
    assert!(flags.underline);
    assert!(flags.strikeout);
    assert!(flags.inverse);
    assert!(flags.dim);
}
```

### instance.rs テスト

```rust
#[test]
fn test_terminal_instance_new() {
    let ti = TerminalInstance::new(80, 24);
    // 生成直後は damage なし
    assert!(ti.collect_damage().is_none());  // ← mut にする必要あり
}

#[test]
fn test_terminal_instance_advance_and_collect() {
    let mut ti = TerminalInstance::new(80, 24);
    ti.advance(b"Hello");
    let result = ti.collect_damage();
    assert!(result.is_some());
    let (cells, cursor, scroll_offset, scrollback_len) = result.unwrap();
    assert!(!cells.is_empty());
    assert_eq!(scroll_offset, 0);
    assert_eq!(scrollback_len, 0);
    // 'H' が cells に含まれること
    assert!(cells.iter().any(|c| c.ch == 'H'));
}

#[test]
fn test_terminal_instance_resize() {
    let mut ti = TerminalInstance::new(80, 24);
    ti.resize(120, 40);
    // resize 後に advance してサイズが反映されていることを確認
    ti.advance(b"\x1b[999;999H");  // カーソルを右下に移動
    let result = ti.collect_damage();
    assert!(result.is_some());
}

#[test]
fn test_terminal_instance_scroll() {
    let mut ti = TerminalInstance::new(80, 24);
    // 大量テキストを出力してスクロールバックを作る
    for _ in 0..50 {
        ti.advance(b"line\r\n");
    }
    ti.collect_damage(); // damage をリセット

    // 上にスクロール
    ti.scroll(5);
    let result = ti.collect_damage();
    assert!(result.is_some());
    let (_, _, scroll_offset, scrollback_len) = result.unwrap();
    assert!(scroll_offset > 0);
    assert!(scrollback_len > 0);
}
```

---

## パフォーマンス確認方法

### 入力遅延の計測

1. `npx tauri dev` でアプリを起動
2. `yes` コマンドを実行（無限出力）
3. Ctrl+C で停止
4. キー入力（`echo test`）が即座に反映されることを確認
5. DevTools の Performance タブでフレームレートを確認

### スクロールの滑らかさ

1. `seq 1 10000` を実行
2. トラックパッドで連続スクロール
3. 目視でカクつきがないことを確認

---

## 設計上の決定事項

| 決定事項 | 理由 |
|---------|------|
| `TerminalInstance::new` のテストでは `mut` 不要 → `collect_damage` は `&mut self` なので `let mut` で生成 | `advance` / `collect_damage` は `&mut self` を要求するため |
| flamegraph は必須としない | `npx tauri dev` 環境で `cargo flamegraph` を組み込むのは複雑。手動の目視確認で代替する |
