use std::path::PathBuf;
use tauri::Manager;

/// フォントファミリー名からフォントファイルのバイト列を返す。
/// CSS の font-family 解決をバイパスして FontFace(family, ArrayBuffer) に渡すために使う。
#[tauri::command]
pub fn load_font_bytes(app: tauri::AppHandle, family: String) -> Result<Vec<u8>, String> {
    let path = find_font_file(&app, &family)
        .ok_or_else(|| format!("フォントファイルが見つかりません: {}", family))?;
    std::fs::read(&path).map_err(|e| e.to_string())
}

fn find_font_file(app: &tauri::AppHandle, family: &str) -> Option<PathBuf> {
    // 1. fc-list で検索（fontconfig がインストールされている場合）
    if let Some(path) = find_via_fc_list(family) {
        return Some(path);
    }
    // 2. フォントディレクトリを直接スキャン
    find_via_dir_scan(app, family)
}

fn find_via_fc_list(family: &str) -> Option<PathBuf> {
    let output = std::process::Command::new("fc-list").output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let family_lower = family.trim().to_lowercase();

    let mut exact_regular: Option<PathBuf> = None;
    let mut exact_any: Option<PathBuf> = None;

    for line in stdout.lines() {
        let Some(entry) = parse_fc_list_entry(line) else {
            continue;
        };
        let family_matches = entry
            .families
            .iter()
            .any(|name| name.trim().to_lowercase() == family_lower);

        if !family_matches {
            continue;
        }

        if exact_any.is_none() {
            exact_any = Some(entry.path.clone());
        }

        if is_regular_style(&entry.style) {
            exact_regular = Some(entry.path);
            break;
        }
    }

    exact_regular.or(exact_any)
}

fn find_via_dir_scan(app: &tauri::AppHandle, family: &str) -> Option<PathBuf> {
    let family_key = family.replace(' ', "").to_lowercase();

    let mut dirs: Vec<PathBuf> = vec![
        PathBuf::from("/Library/Fonts"),
        PathBuf::from("/System/Library/Fonts"),
        PathBuf::from("/System/Library/Fonts/Supplemental"),
    ];
    if let Ok(user_dir) = app.path().font_dir() {
        dirs.insert(0, user_dir);
    }

    for dir in &dirs {
        let Ok(entries) = std::fs::read_dir(dir) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            let name_key = name.replace(['-', '_'], "");
            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if matches!(ext.as_str(), "ttf" | "otf" | "woff" | "woff2")
                && name_key.starts_with(&family_key)
            {
                return Some(entry.path());
            }
        }
    }
    None
}

struct FcListEntry {
    path: PathBuf,
    families: Vec<String>,
    style: String,
}

fn parse_fc_list_entry(line: &str) -> Option<FcListEntry> {
    let mut parts = line.splitn(3, ':');
    let path = PathBuf::from(parts.next()?.trim());
    let families = parts
        .next()?
        .split(',')
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();
    let style = parts.next().unwrap_or_default().trim().to_string();

    if families.is_empty() {
        return None;
    }

    Some(FcListEntry {
        path,
        families,
        style,
    })
}

fn is_regular_style(style: &str) -> bool {
    let normalized = style
        .trim()
        .strip_prefix("style=")
        .unwrap_or(style)
        .trim()
        .to_lowercase();

    let tokens = normalized
        .split(',')
        .map(|token| token.trim())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();

    !tokens.is_empty() && tokens.iter().all(|token| *token == "regular")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_fc_list_entry_extracts_path_family_and_style() {
        let entry = parse_fc_list_entry(
            "/Users/test/IntelOneMono-Regular.otf: Intel One Mono:style=Regular",
        )
        .unwrap();

        assert_eq!(entry.path, PathBuf::from("/Users/test/IntelOneMono-Regular.otf"));
        assert_eq!(entry.families, vec!["Intel One Mono".to_string()]);
        assert_eq!(entry.style, "style=Regular");
    }

    #[test]
    fn parse_fc_list_entry_supports_multiple_family_names() {
        let entry = parse_fc_list_entry(
            "/Users/test/IntelOneMono-Light.otf: Intel One Mono,Intel One Mono Light:style=Light,Regular",
        )
        .unwrap();

        assert_eq!(
            entry.families,
            vec![
                "Intel One Mono".to_string(),
                "Intel One Mono Light".to_string()
            ]
        );
    }

    #[test]
    fn regular_style_detection_ignores_light_regular_combo() {
        assert!(is_regular_style("style=Regular"));
        assert!(is_regular_style("style=Regular,Regular"));
        assert!(!is_regular_style("style=Light,Regular"));
        assert!(!is_regular_style("style=Medium,Regular"));
    }
}
