use alacritty_terminal::grid::{Dimensions, Scroll};
use alacritty_terminal::term::cell::Flags;
use alacritty_terminal::term::{Config, Term};
use alacritty_terminal::vte::ansi;

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
    pub fn new(cols: u16, lines: u16) -> Self {
        let config = Config {
            scrolling_history: 10_000,
            ..Config::default()
        };
        let size = TermSize {
            cols: cols as usize,
            lines: lines as usize,
        };
        let term = Term::new(config, &size, TermEventHandler);
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
