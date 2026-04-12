use alacritty_terminal::term::cell::Flags;
use alacritty_terminal::vte::ansi::Color;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CellData {
    pub row: u16,
    pub col: u16,
    pub ch: char,
    /// true: 全角文字（WIDE_CHAR フラグ）, false: 半角
    /// WIDE_CHAR_SPACER のセルはこのリストに含まれない（呼び出し元でスキップ）
    pub wide: bool,
    pub fg: ColorData,
    pub bg: ColorData,
    pub flags: CellFlags,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "value")]
pub enum ColorData {
    /// ANSI 16色（NamedColor as u8）
    Named(u8),
    /// xterm 256色
    Indexed(u8),
    /// トゥルーカラー
    Rgb { r: u8, g: u8, b: u8 },
}

#[derive(Debug, Clone, Serialize)]
pub struct CellFlags {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikeout: bool,
    pub inverse: bool,
    pub dim: bool,
}

pub fn color_to_data(color: Color) -> ColorData {
    match color {
        Color::Named(n) => ColorData::Named(n as u8),
        Color::Indexed(i) => ColorData::Indexed(i),
        Color::Spec(rgb) => ColorData::Rgb { r: rgb.r, g: rgb.g, b: rgb.b },
    }
}

pub fn flags_to_cell_flags(flags: Flags) -> CellFlags {
    CellFlags {
        bold: flags.contains(Flags::BOLD),
        italic: flags.contains(Flags::ITALIC),
        underline: flags.intersects(Flags::ALL_UNDERLINES),
        strikeout: flags.contains(Flags::STRIKEOUT),
        inverse: flags.contains(Flags::INVERSE),
        dim: flags.contains(Flags::DIM),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_data_serialize() {
        let cell = CellData {
            row: 0,
            col: 0,
            ch: 'A',
            wide: false,
            fg: ColorData::Named(7),
            bg: ColorData::Named(0),
            flags: CellFlags {
                bold: false,
                italic: false,
                underline: false,
                strikeout: false,
                inverse: false,
                dim: false,
            },
        };
        let json = serde_json::to_string(&cell).unwrap();
        assert!(json.contains("\"ch\":\"A\""));
        assert!(json.contains("\"wide\":false"));
    }

    #[test]
    fn test_color_data_named_serialize() {
        let color = ColorData::Named(1);
        let json = serde_json::to_string(&color).unwrap();
        assert_eq!(json, r#"{"type":"Named","value":1}"#);
    }

    #[test]
    fn test_color_data_rgb_serialize() {
        let color = ColorData::Rgb { r: 255, g: 128, b: 0 };
        let json = serde_json::to_string(&color).unwrap();
        assert!(json.contains("\"type\":\"Rgb\""));
        assert!(json.contains("\"r\":255"));
    }
}
