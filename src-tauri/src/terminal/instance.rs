use alacritty_terminal::grid::{Dimensions, Scroll};
use alacritty_terminal::index::{Column, Line, Point};
use alacritty_terminal::term::cell::Flags;
use alacritty_terminal::term::{Config, Term};
use alacritty_terminal::vte::ansi;
use tauri::AppHandle;

use super::event::TermEventHandler;
use super::grid::{color_to_data, flags_to_cell_flags, CellData};
use super::CursorPos;

/// Term::new に渡す端末サイズ
struct TermSize {
    cols: usize,
    lines: usize,
}

impl Dimensions for TermSize {
    fn columns(&self) -> usize {
        self.cols
    }
    fn screen_lines(&self) -> usize {
        self.lines
    }
    fn total_lines(&self) -> usize {
        self.lines
    }
}

pub struct TerminalInstance {
    pub term: Term<TermEventHandler>,
    pub parser: ansi::Processor,
}

impl TerminalInstance {
    pub fn new(cols: u16, lines: u16, app: AppHandle, pty_id: String) -> Self {
        Self::from_handler(cols, lines, TermEventHandler::new(app, pty_id))
    }

    /// ユニットテスト用: `AppHandle` を必要とせずインスタンスを生成する。
    #[cfg(test)]
    pub fn new_for_test(cols: u16, lines: u16) -> Self {
        Self::from_handler(cols, lines, TermEventHandler::noop())
    }

    fn from_handler(cols: u16, lines: u16, handler: TermEventHandler) -> Self {
        let config = Config {
            scrolling_history: 10_000,
            ..Config::default()
        };
        let size = TermSize {
            cols: cols as usize,
            lines: lines as usize,
        };
        let term = Term::new(config, &size, handler);
        let parser = ansi::Processor::new();
        Self { term, parser }
    }

    /// PTY 出力バイト列を Term に送り込む
    pub fn advance(&mut self, bytes: &[u8]) {
        self.parser.advance(&mut self.term, bytes);
    }

    /// ディスプレイをスクロールする（正=上スクロール、負=下スクロール）
    pub fn scroll(&mut self, delta: i32) {
        self.term.scroll_display(Scroll::Delta(delta));
    }

    /// damage があれば全可視セルを収集して返す。damage がなければ None
    /// 戻り値: (cells, cursor, scroll_offset, scrollback_len)
    pub fn collect_damage(&mut self) -> Option<(Vec<CellData>, CursorPos, u32, u32)> {
        use alacritty_terminal::term::TermDamage;

        // damage の有無を確認してから reset する（TermDamage が term を借用するためブロックで分離）
        let has_damage = {
            match self.term.damage() {
                TermDamage::Full => true,
                TermDamage::Partial(mut iter) => iter.next().is_some(),
            }
        };
        self.term.reset_damage();

        if !has_damage {
            return None;
        }

        let display_offset_usize = self.term.grid().display_offset();
        let display_offset = display_offset_usize as i32;
        let content = self.term.renderable_content();

        // cursor はスクロール中もビューポート内の実際の位置を保持する
        let cursor = CursorPos {
            row: (content.cursor.point.line.0 + display_offset).max(0) as u16,
            col: content.cursor.point.column.0 as u16,
        };

        let cells: Vec<CellData> = content
            .display_iter
            .filter(|indexed| !indexed.flags.contains(Flags::WIDE_CHAR_SPACER))
            .map(|indexed| CellData {
                // display_iter はグリッド絶対行番号（スクロール時は負値）を返す。
                // display_offset を加算してビューポート行（0 〜 screen_lines-1）に変換する。
                row: (indexed.point.line.0 + display_offset).max(0) as u16,
                col: indexed.point.column.0 as u16,
                ch: indexed.c,
                wide: indexed.flags.contains(Flags::WIDE_CHAR),
                fg: color_to_data(indexed.fg),
                bg: color_to_data(indexed.bg),
                flags: flags_to_cell_flags(indexed.flags),
            })
            .collect();

        let scroll_offset = display_offset_usize as u32;
        let scrollback_len = self.term.history_size() as u32;

        Some((cells, cursor, scroll_offset, scrollback_len))
    }

    pub fn resize(&mut self, cols: u16, lines: u16) {
        let size = TermSize {
            cols: cols as usize,
            lines: lines as usize,
        };
        self.term.resize(size);
    }

    /// alacritty のグリッド絶対行範囲 `line_from..=line_to` からテキストを切り出す。
    /// 負の行はスクロールバック履歴、0..screen_lines-1 は現在のアクティブ画面を指す。
    /// 選択範囲が現在のビューポート外にスクロールアウトしていても参照できるよう、
    /// Grid を直接インデックスする。
    pub fn extract_text(&self, line_from: i32, line_to: i32, col_from: u16, col_to: u16) -> String {
        let cols = self.term.columns();
        if cols == 0 {
            return String::new();
        }
        let history_size = self.term.history_size() as i32;
        let screen_lines = self.term.screen_lines() as i32;

        // 範囲を Grid の有効範囲 [-history_size, screen_lines-1] にクリップ
        let min_line = -history_size;
        let max_line = screen_lines - 1;
        let from = line_from.max(min_line).min(max_line);
        let to = line_to.max(min_line).min(max_line);
        if from > to {
            return String::new();
        }

        let grid = self.term.grid();
        let mut out = String::new();
        for l in from..=to {
            let start_col = if l == from { col_from as usize } else { 0 };
            let end_col = if l == to { col_to as usize } else { cols };
            let end_col = end_col.min(cols);
            let start_col = start_col.min(end_col);

            let mut row_text = String::new();
            for c in start_col..end_col {
                let cell = &grid[Point::new(Line(l), Column(c))];
                // WIDE_CHAR_SPACER は wide 文字の 2 セル目で同じ文字が重複するためスキップ
                if cell.flags.contains(Flags::WIDE_CHAR_SPACER) {
                    continue;
                }
                row_text.push(cell.c);
            }
            out.push_str(row_text.trim_end());
            if l < to {
                out.push('\n');
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_creates_instance() {
        let ti = TerminalInstance::new_for_test(80, 24);
        // Term が正しいサイズで生成されていること
        assert_eq!(ti.term.columns(), 80);
        assert_eq!(ti.term.screen_lines(), 24);
    }

    #[test]
    fn test_advance_produces_damage() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        let _ = ti.collect_damage(); // 初期 damage を消費
        ti.advance(b"Hello");
        let result = ti.collect_damage();
        assert!(result.is_some());
    }

    #[test]
    fn test_advance_cells_contain_text() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"ABC");
        let (cells, _cursor, _so, _sl) = ti.collect_damage().unwrap();
        // 'A', 'B', 'C' がセルに含まれること
        assert!(cells.iter().any(|c| c.ch == 'A'));
        assert!(cells.iter().any(|c| c.ch == 'B'));
        assert!(cells.iter().any(|c| c.ch == 'C'));
    }

    #[test]
    fn test_advance_cursor_position() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"Hi");
        let (_cells, cursor, _so, _sl) = ti.collect_damage().unwrap();
        // カーソルは 'H'(col=0), 'i'(col=1) の次 → col=2
        assert_eq!(cursor.row, 0);
        assert_eq!(cursor.col, 2);
    }

    #[test]
    fn test_advance_no_scroll_initially() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"test");
        let (_cells, _cursor, scroll_offset, scrollback_len) = ti.collect_damage().unwrap();
        assert_eq!(scroll_offset, 0);
        assert_eq!(scrollback_len, 0);
    }

    #[test]
    fn test_advance_builds_scrollback() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        // 24行を超える出力でスクロールバックが発生
        for _ in 0..30 {
            ti.advance(b"line\r\n");
        }
        let (_cells, _cursor, scroll_offset, scrollback_len) = ti.collect_damage().unwrap();
        assert_eq!(scroll_offset, 0); // 自動スクロールで末尾にいる
        assert!(scrollback_len > 0, "scrollback should have accumulated");
    }

    #[test]
    fn test_scroll_changes_offset() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        for _ in 0..50 {
            ti.advance(b"line\r\n");
        }
        let _ = ti.collect_damage(); // damage をリセット

        // 上にスクロール
        ti.scroll(5);
        let result = ti.collect_damage();
        assert!(result.is_some());
        let (_cells, _cursor, scroll_offset, _sl) = result.unwrap();
        assert_eq!(scroll_offset, 5);
    }

    #[test]
    fn test_scroll_back_to_bottom() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        for _ in 0..50 {
            ti.advance(b"line\r\n");
        }
        let _ = ti.collect_damage();

        ti.scroll(10); // 上に 10 行
        let _ = ti.collect_damage();

        ti.scroll(-10); // 下に 10 行（末尾に戻る）
        let result = ti.collect_damage();
        assert!(result.is_some());
        let (_cells, _cursor, scroll_offset, _sl) = result.unwrap();
        assert_eq!(scroll_offset, 0);
    }

    #[test]
    fn test_scroll_at_boundary_offset_stays_zero() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"short");
        let _ = ti.collect_damage();

        // スクロールバックがない状態で上スクロールしても offset は 0 のまま
        ti.scroll(5);
        // damage の有無は実装次第だが、offset は 0
        if let Some((_cells, _cursor, scroll_offset, _sl)) = ti.collect_damage() {
            assert_eq!(scroll_offset, 0);
        }
    }

    #[test]
    fn test_resize() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.resize(120, 40);
        assert_eq!(ti.term.columns(), 120);
        assert_eq!(ti.term.screen_lines(), 40);
    }

    #[test]
    fn test_resize_produces_damage() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        let _ = ti.collect_damage(); // 初期 damage を消費
        ti.resize(100, 30);
        // resize は damage を発生させる
        assert!(ti.collect_damage().is_some());
    }

    #[test]
    fn test_resize_cols_rows_reflected_in_cells() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.resize(40, 10);
        ti.advance(b"X");
        let (cells, _cursor, _so, _sl) = ti.collect_damage().unwrap();
        // すべてのセルが新しいサイズ範囲内にあること
        for cell in &cells {
            assert!(cell.col < 40, "col {} should be < 40", cell.col);
            assert!(cell.row < 10, "row {} should be < 10", cell.row);
        }
    }

    // ---- extract_text のテスト ----

    #[test]
    fn test_extract_text_single_line_full() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"hello");
        // 1 行目を 0..5 列で抽出
        let text = ti.extract_text(0, 0, 0, 5);
        assert_eq!(text, "hello");
    }

    #[test]
    fn test_extract_text_single_line_partial_cols() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"abcdef");
        // col 2..5 を抽出（"cde"）
        let text = ti.extract_text(0, 0, 2, 5);
        assert_eq!(text, "cde");
    }

    #[test]
    fn test_extract_text_trims_trailing_spaces_per_line() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"hi");
        // 1 行目を 0..80 列で抽出しても末尾空白は trim される
        let text = ti.extract_text(0, 0, 0, 80);
        assert_eq!(text, "hi");
    }

    #[test]
    fn test_extract_text_multi_line() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"aaa\r\nbbb\r\nccc");
        // 3 行（行 0..2）を抽出
        let text = ti.extract_text(0, 2, 0, 80);
        assert_eq!(text, "aaa\nbbb\nccc");
    }

    #[test]
    fn test_extract_text_multi_line_col_clipping() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"ABCDE\r\nFGHIJ\r\nKLMNO");
        // 行 0: col 2..（"CDE"）, 行 1: 全 col（"FGHIJ"）, 行 2: ..3 col（"KLM"）
        let text = ti.extract_text(0, 2, 2, 3);
        assert_eq!(text, "CDE\nFGHIJ\nKLM");
    }

    #[test]
    fn test_extract_text_from_scrollback() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        // 画面行数を超えて出力し、スクロールバックに流す
        for i in 0..30 {
            let line = format!("line{:02}\r\n", i);
            ti.advance(line.as_bytes());
        }
        // 最初の方の行（line00〜line05 付近）はすでにスクロールバックに流れているはずで、
        // ビューポート(Line(0..23)) からは取れないが、負の Line を辿れば取り出せる。
        // alacritty の内部で Line(0) が active screen のどこを指すかは実装依存なので、
        // ここでは「十分広い範囲を走査すれば line00 が含まれる」ことだけ確認する。
        let all = ti.extract_text(-50, 23, 0, 80);
        assert!(all.contains("line00"), "earliest scrollback line should be reachable");
        assert!(all.contains("line29"), "last written line should be reachable");
    }

    #[test]
    fn test_extract_text_clips_out_of_range() {
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"only");
        // 履歴も無く line_from が有効範囲外でもパニックせず、有効範囲にクリップされる
        let text = ti.extract_text(-100, 100, 0, 80);
        // 少なくとも "only" を含むこと
        assert!(text.contains("only"));
    }

    #[test]
    fn test_extract_text_empty_when_from_exceeds_to() {
        let ti = TerminalInstance::new_for_test(80, 24);
        // line_from > line_to（クリップ後も）のケース
        let text = ti.extract_text(10, 5, 0, 80);
        assert_eq!(text, "");
    }

    #[test]
    fn test_extract_text_follows_scroll_semantics() {
        // 選択をスクロールバック絶対行で保存した状態で、表示行数を超えて出力されても
        // 同じ行内容が取り出せることを確認する（UI 側の「スクロール追随」の根拠）。
        let mut ti = TerminalInstance::new_for_test(80, 24);
        ti.advance(b"MARKER\r\n");
        // ビューポート上では Line(0) に "MARKER" がある
        assert_eq!(ti.extract_text(0, 0, 0, 80), "MARKER");

        // この後大量に出力すると MARKER はスクロールバックに押し出される
        for _ in 0..40 {
            ti.advance(b"x\r\n");
        }
        // MARKER はもはや Line(0) にはない（現在のビューポート上には "x" しかない）
        assert_ne!(ti.extract_text(0, 0, 0, 80), "MARKER");

        // しかし絶対行的には Line(-41) 付近に退避している。
        // 全履歴を走査して含まれていることを確認する。
        let all = ti.extract_text(-100, 23, 0, 80);
        assert!(all.contains("MARKER"), "MARKER should still be reachable via scrollback");
    }
}
