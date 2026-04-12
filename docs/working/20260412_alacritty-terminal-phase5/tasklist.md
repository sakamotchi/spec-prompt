# タスクリスト - alacritty-terminal Phase 5（テスト・品質）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 表示品質確認

- [x] Claude Code を起動し、CJK 文字・ボックス描画文字が正しく表示されることを確認
- [x] `echo -e "\e[31mRed \e[32mGreen \e[34mBlue\e[0m"` で ANSI 16色を確認
- [x] `python3 -c "for i in range(256): print(f'\033[38;5;{i}m{i:>4}\033[0m', end='' if (i+1)%16 else '\n')"` で 256色を確認
- [x] `echo -e "\e[1mBold \e[3mItalic \e[4mUnderline \e[9mStrike \e[7mInverse \e[2mDim\e[0m"` で属性を確認

### T-2: リサイズ安定性確認

- [x] ウィンドウを連続してリサイズし、表示が崩れないことを確認
- [x] コンテンツタブ → ターミナルタブに切り替え後、サイズが正しいことを確認
- [x] 分割レイアウト ON → OFF → ON でターミナルが正しく再描画されることを確認
- [x] 最小ウィンドウサイズ付近で異常が発生しないことを確認

### T-3: フォント切り替え確認

- [x] 設定画面でフォントファミリーを変更し、ターミナルに即座に反映されることを確認
- [x] フォントサイズを変更し、cols/rows が再計算されることを確認（プロンプトの折り返し位置で判定）
- [x] フォント変更後にコマンド入力・出力が正しく表示されることを確認

### T-4: パフォーマンス確認

- [x] `yes` コマンド実行中にキー入力（Ctrl+C）が速やかに反映されることを確認
- [x] `seq 1 10000` 後のスクロールが滑らかであることを確認
- [x] Claude Code を起動して長いレスポンス生成中もアプリが応答することを確認

### T-5: Rust テスト追加

- [x] `grid.rs` に `color_to_data` のテストを追加（Named 0-15, Named >= 16, Indexed, Rgb）
- [x] `grid.rs` に `flags_to_cell_flags` のテストを追加（empty, 個別フラグ, 複合フラグ）
- [x] `instance.rs` に `TerminalInstance::new` のテストを追加
- [x] `instance.rs` に `advance` → `collect_damage` のテストを追加
- [x] `instance.rs` に `scroll` のテストを追加
- [x] `instance.rs` に `resize` のテストを追加
- [x] `cargo test` で全テストが通ること

## 完了条件

- [x] 全タスクが完了している
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし
- [x] `cd src-tauri && cargo test` がパス（新規テスト含む）
- [x] 手動テストが全件 OK
