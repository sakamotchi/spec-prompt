use alacritty_terminal::grid::{Dimensions, Scroll};
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
}
