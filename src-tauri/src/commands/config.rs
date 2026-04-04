use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    pub theme: String,
    pub content_font_family: String,
    pub content_font_size: u8,
    pub terminal_font_family: String,
    pub terminal_font_size: u8,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            content_font_family: "Geist".to_string(),
            content_font_size: 16,
            terminal_font_family: "Geist Mono".to_string(),
            terminal_font_size: 14,
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
        .join("spec-prompt");
    Ok(dir.join("config.json"))
}

fn load_config(app: &tauri::AppHandle) -> Config {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return Config::default(),
    };
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
}
