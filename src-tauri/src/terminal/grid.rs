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
    /// ANSI 16色（NamedColor 0-15）
    Named(u8),
    /// xterm 256色
    Indexed(u8),
    /// トゥルーカラー
    Rgb { r: u8, g: u8, b: u8 },
    /// ターミナルのデフォルト色（Foreground=256, Background=257 等）
    /// フロントエンドがテーマのデフォルト fg/bg で描画する
    Default,
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
        Color::Named(n) => {
            let v = n as usize;
            if v < 16 {
                // ANSI 16色（0-15）
                ColorData::Named(v as u8)
            } else {
                // Foreground=256, Background=257, Cursor=258 などセマンティック色
                // → フロントエンドがテーマのデフォルト色で描画する
                ColorData::Default
            }
        }
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
    use alacritty_terminal::vte::ansi::NamedColor;

    // ---- シリアライズテスト（既存） ----

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

    #[test]
    fn test_color_data_default_serialize() {
        let color = ColorData::Default;
        let json = serde_json::to_string(&color).unwrap();
        assert_eq!(json, r#"{"type":"Default"}"#);
    }

    #[test]
    fn test_color_data_indexed_serialize() {
        let color = ColorData::Indexed(128);
        let json = serde_json::to_string(&color).unwrap();
        assert_eq!(json, r#"{"type":"Indexed","value":128}"#);
    }

    // ---- color_to_data 変換テスト ----

    #[test]
    fn test_color_to_data_named_0_to_15() {
        // ANSI 16色（0〜15）→ ColorData::Named
        let named_colors = [
            NamedColor::Black, NamedColor::Red, NamedColor::Green, NamedColor::Yellow,
            NamedColor::Blue, NamedColor::Magenta, NamedColor::Cyan, NamedColor::White,
            NamedColor::BrightBlack, NamedColor::BrightRed, NamedColor::BrightGreen,
            NamedColor::BrightYellow, NamedColor::BrightBlue, NamedColor::BrightMagenta,
            NamedColor::BrightCyan, NamedColor::BrightWhite,
        ];
        for (i, &named) in named_colors.iter().enumerate() {
            match color_to_data(Color::Named(named)) {
                ColorData::Named(v) => assert_eq!(v, i as u8, "Named({i}) should map to Named({i})"),
                other => panic!("Expected Named({i}), got {:?}", other),
            }
        }
    }

    #[test]
    fn test_color_to_data_named_foreground_returns_default() {
        // NamedColor::Foreground (= 256) → ColorData::Default
        assert!(matches!(
            color_to_data(Color::Named(NamedColor::Foreground)),
            ColorData::Default
        ));
    }

    #[test]
    fn test_color_to_data_named_background_returns_default() {
        // NamedColor::Background (= 257) → ColorData::Default
        assert!(matches!(
            color_to_data(Color::Named(NamedColor::Background)),
            ColorData::Default
        ));
    }

    #[test]
    fn test_color_to_data_named_cursor_returns_default() {
        // NamedColor::Cursor (= 258) → ColorData::Default
        assert!(matches!(
            color_to_data(Color::Named(NamedColor::Cursor)),
            ColorData::Default
        ));
    }

    #[test]
    fn test_color_to_data_indexed() {
        assert!(matches!(
            color_to_data(Color::Indexed(0)),
            ColorData::Indexed(0)
        ));
        assert!(matches!(
            color_to_data(Color::Indexed(128)),
            ColorData::Indexed(128)
        ));
        assert!(matches!(
            color_to_data(Color::Indexed(255)),
            ColorData::Indexed(255)
        ));
    }

    #[test]
    fn test_color_to_data_rgb() {
        use alacritty_terminal::vte::ansi::Rgb;
        match color_to_data(Color::Spec(Rgb { r: 255, g: 128, b: 0 })) {
            ColorData::Rgb { r, g, b } => {
                assert_eq!(r, 255);
                assert_eq!(g, 128);
                assert_eq!(b, 0);
            }
            other => panic!("Expected Rgb, got {:?}", other),
        }
    }

    #[test]
    fn test_color_to_data_rgb_black() {
        use alacritty_terminal::vte::ansi::Rgb;
        match color_to_data(Color::Spec(Rgb { r: 0, g: 0, b: 0 })) {
            ColorData::Rgb { r, g, b } => {
                assert_eq!(r, 0);
                assert_eq!(g, 0);
                assert_eq!(b, 0);
            }
            other => panic!("Expected Rgb, got {:?}", other),
        }
    }

    // ---- flags_to_cell_flags 変換テスト ----

    #[test]
    fn test_flags_empty() {
        let cf = flags_to_cell_flags(Flags::empty());
        assert!(!cf.bold);
        assert!(!cf.italic);
        assert!(!cf.underline);
        assert!(!cf.strikeout);
        assert!(!cf.inverse);
        assert!(!cf.dim);
    }

    #[test]
    fn test_flags_bold_only() {
        let cf = flags_to_cell_flags(Flags::BOLD);
        assert!(cf.bold);
        assert!(!cf.italic);
        assert!(!cf.underline);
    }

    #[test]
    fn test_flags_italic_only() {
        let cf = flags_to_cell_flags(Flags::ITALIC);
        assert!(!cf.bold);
        assert!(cf.italic);
    }

    #[test]
    fn test_flags_underline_only() {
        let cf = flags_to_cell_flags(Flags::UNDERLINE);
        assert!(cf.underline);
        assert!(!cf.strikeout);
    }

    #[test]
    fn test_flags_strikeout_only() {
        let cf = flags_to_cell_flags(Flags::STRIKEOUT);
        assert!(cf.strikeout);
        assert!(!cf.underline);
    }

    #[test]
    fn test_flags_inverse_only() {
        let cf = flags_to_cell_flags(Flags::INVERSE);
        assert!(cf.inverse);
        assert!(!cf.dim);
    }

    #[test]
    fn test_flags_dim_only() {
        let cf = flags_to_cell_flags(Flags::DIM);
        assert!(cf.dim);
        assert!(!cf.bold);
    }

    #[test]
    fn test_flags_all_combined() {
        let cf = flags_to_cell_flags(
            Flags::BOLD | Flags::ITALIC | Flags::UNDERLINE | Flags::STRIKEOUT | Flags::INVERSE | Flags::DIM,
        );
        assert!(cf.bold);
        assert!(cf.italic);
        assert!(cf.underline);
        assert!(cf.strikeout);
        assert!(cf.inverse);
        assert!(cf.dim);
    }

    #[test]
    fn test_flags_bold_italic_combined() {
        let cf = flags_to_cell_flags(Flags::BOLD | Flags::ITALIC);
        assert!(cf.bold);
        assert!(cf.italic);
        assert!(!cf.underline);
        assert!(!cf.strikeout);
        assert!(!cf.inverse);
        assert!(!cf.dim);
    }
}
