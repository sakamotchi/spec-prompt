use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const APP_DIR: &str = "sddesk";
const LEGACY_APP_DIR: &str = "spec-prompt";
const CONFIG_FILENAME: &str = "config.json";
const MIGRATED_SUFFIX: &str = "config.json.migrated";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    pub theme: String,
    pub content_font_family: String,
    pub content_font_size: u8,
    pub terminal_font_family: String,
    pub terminal_font_size: u8,
    #[serde(default = "default_true")]
    pub notification_enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            content_font_family: "Geist".to_string(),
            content_font_size: 16,
            terminal_font_family: "Geist Mono".to_string(),
            terminal_font_size: 14,
            notification_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub recent_projects: Vec<String>,
    #[serde(default)]
    pub appearance: AppearanceSettings,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            recent_projects: vec![],
            appearance: AppearanceSettings::default(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .config_dir()
        .map_err(|e| e.to_string())?
        .join(APP_DIR);
    Ok(dir.join(CONFIG_FILENAME))
}

fn legacy_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .config_dir()
        .map_err(|e| e.to_string())?
        .join(LEGACY_APP_DIR);
    Ok(dir.join(CONFIG_FILENAME))
}

/// 旧 `spec-prompt/config.json` を新 `sddesk/config.json` へ移行する。
/// 新パス存在時・旧パス非存在時は no-op。
/// 移行後の旧ファイルは `config.json.migrated` にリネームして保全する
/// （削除はしない：ユーザーが手動で残したい場合の安全策）。
fn migrate_legacy_config_file(legacy_path: &Path, new_path: &Path) -> Result<bool, String> {
    if new_path.exists() {
        return Ok(false);
    }
    if !legacy_path.exists() {
        return Ok(false);
    }
    if let Some(dir) = new_path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::copy(legacy_path, new_path).map_err(|e| e.to_string())?;
    let backup = legacy_path.with_file_name(MIGRATED_SUFFIX);
    let _ = fs::rename(legacy_path, &backup);
    Ok(true)
}

fn load_config(app: &tauri::AppHandle) -> Config {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return Config::default(),
    };
    if let Ok(legacy) = legacy_config_path(app) {
        let _ = migrate_legacy_config_file(&legacy, &path);
    }
    let Ok(data) = fs::read_to_string(&path) else {
        return Config::default();
    };
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_config(app: &tauri::AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(load_config(&app).recent_projects)
}

#[tauri::command]
pub fn get_appearance(app: tauri::AppHandle) -> Result<AppearanceSettings, String> {
    Ok(load_config(&app).appearance)
}

#[tauri::command]
pub fn save_appearance(app: tauri::AppHandle, settings: AppearanceSettings) -> Result<(), String> {
    let mut config = load_config(&app);
    config.appearance = settings;
    save_config(&app, &config)
}

#[tauri::command]
pub fn add_recent_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut config = load_config(&app);
    config.recent_projects.retain(|p| p != &path);
    config.recent_projects.insert(0, path);
    config.recent_projects.truncate(10);
    save_config(&app, &config)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_config(projects: &[&str]) -> Config {
        Config {
            recent_projects: projects.iter().map(|s| s.to_string()).collect(),
            appearance: AppearanceSettings::default(),
        }
    }

    fn add_to(config: &mut Config, path: &str) {
        config.recent_projects.retain(|p| p != path);
        config.recent_projects.insert(0, path.to_string());
        config.recent_projects.truncate(10);
    }

    #[test]
    fn test_add_deduplication() {
        let mut config = make_config(&["/a", "/b", "/c"]);
        add_to(&mut config, "/b");
        assert_eq!(config.recent_projects, vec!["/b", "/a", "/c"]);
    }

    #[test]
    fn test_add_new_project_prepended() {
        let mut config = make_config(&["/a", "/b"]);
        add_to(&mut config, "/c");
        assert_eq!(config.recent_projects[0], "/c");
        assert_eq!(config.recent_projects.len(), 3);
    }

    #[test]
    fn test_max_10_projects() {
        let mut config = Config::default();
        for i in 0..11 {
            add_to(&mut config, &format!("/project-{}", i));
        }
        assert_eq!(config.recent_projects.len(), 10);
        // 最古の /project-0 が切り捨てられている
        assert!(!config.recent_projects.contains(&"/project-0".to_string()));
    }

    #[test]
    fn test_default_config_empty() {
        let config = Config::default();
        assert!(config.recent_projects.is_empty());
    }

    #[test]
    fn test_config_json_roundtrip() {
        let config = make_config(&["/foo", "/bar"]);
        let json = serde_json::to_string(&config).unwrap();
        let restored: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.recent_projects, config.recent_projects);
    }

    #[test]
    fn test_invalid_json_returns_default() {
        let result: Config = serde_json::from_str("not json").unwrap_or_default();
        assert!(result.recent_projects.is_empty());
    }

    #[test]
    fn test_appearance_default() {
        let s = AppearanceSettings::default();
        assert_eq!(s.theme, "dark");
        assert_eq!(s.content_font_size, 16);
        assert_eq!(s.terminal_font_size, 14);
        assert_eq!(s.content_font_family, "Geist");
        assert_eq!(s.terminal_font_family, "Geist Mono");
    }

    #[test]
    fn test_config_with_appearance_roundtrip() {
        let mut config = make_config(&["/a"]);
        config.appearance.theme = "light".to_string();
        config.appearance.content_font_size = 18;
        let json = serde_json::to_string(&config).unwrap();
        let restored: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.appearance.theme, "light");
        assert_eq!(restored.appearance.content_font_size, 18);
    }

    #[test]
    fn test_config_without_appearance_field_uses_default() {
        // 既存の config.json（appearance フィールドなし）との後方互換
        let json = r#"{"recent_projects":["/foo"]}"#;
        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.appearance.theme, "dark");
        assert_eq!(config.appearance.content_font_size, 16);
    }

    #[test]
    fn test_migrate_legacy_config_copies_when_new_absent() {
        let tmp = tempfile::tempdir().unwrap();
        let legacy = tmp.path().join("spec-prompt").join("config.json");
        let new_path = tmp.path().join("sddesk").join("config.json");
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        fs::write(&legacy, r#"{"recent_projects":["/a"]}"#).unwrap();

        let migrated = migrate_legacy_config_file(&legacy, &new_path).unwrap();
        assert!(migrated, "migration should report true");
        assert!(new_path.exists(), "new config should exist");
        assert!(!legacy.exists(), "legacy config should be renamed");
        let backup = legacy.with_file_name("config.json.migrated");
        assert!(backup.exists(), "legacy should be kept as .migrated");
    }

    #[test]
    fn test_migrate_legacy_config_no_op_when_new_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let legacy = tmp.path().join("spec-prompt").join("config.json");
        let new_path = tmp.path().join("sddesk").join("config.json");
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        fs::create_dir_all(new_path.parent().unwrap()).unwrap();
        fs::write(&legacy, r#"{"recent_projects":["/legacy"]}"#).unwrap();
        fs::write(&new_path, r#"{"recent_projects":["/current"]}"#).unwrap();

        let migrated = migrate_legacy_config_file(&legacy, &new_path).unwrap();
        assert!(!migrated, "no migration when new exists");
        let content = fs::read_to_string(&new_path).unwrap();
        assert!(content.contains("/current"), "new config must be untouched");
        assert!(legacy.exists(), "legacy must remain untouched");
    }

    #[test]
    fn test_migrate_legacy_config_no_op_when_legacy_absent() {
        let tmp = tempfile::tempdir().unwrap();
        let legacy = tmp.path().join("spec-prompt").join("config.json");
        let new_path = tmp.path().join("sddesk").join("config.json");

        let migrated = migrate_legacy_config_file(&legacy, &new_path).unwrap();
        assert!(!migrated);
        assert!(!new_path.exists());
    }
}
