use alacritty_terminal::grid::Dimensions;
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
        let config = Config::default();
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

    /// damage があれば全可視セルを収集して返す。damage がなければ None
    pub fn collect_damage(&mut self) -> Option<(Vec<CellData>, CursorPos)> {
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

        let content = self.term.renderable_content();

        let cursor = CursorPos {
            row: content.cursor.point.line.0.max(0) as u16,
            col: content.cursor.point.column.0 as u16,
        };

        let cells: Vec<CellData> = content
            .display_iter
            .filter(|indexed| !indexed.flags.contains(Flags::WIDE_CHAR_SPACER))
            .map(|indexed| CellData {
                row: indexed.point.line.0.max(0) as u16,
                col: indexed.point.column.0 as u16,
                ch: indexed.c,
                wide: indexed.flags.contains(Flags::WIDE_CHAR),
                fg: color_to_data(indexed.fg),
                bg: color_to_data(indexed.bg),
                flags: flags_to_cell_flags(indexed.flags),
            })
            .collect();

        Some((cells, cursor))
    }

    pub fn resize(&mut self, cols: u16, lines: u16) {
        let size = TermSize {
            cols: cols as usize,
            lines: lines as usize,
        };
        self.term.resize(size);
    }
}
