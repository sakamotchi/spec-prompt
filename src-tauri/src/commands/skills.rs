use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Skill の出所。Claude Code の skill スコープに準ずる（ユーザー / プロジェクト）。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillKind {
    User,
    Project,
}

/// `list_claude_skills` が返す 1 件分の Skill メタデータ。
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadata {
    pub kind: SkillKind,
    pub name: String,
    pub description: Option<String>,
    pub argument_hint: Option<String>,
    pub path: String,
}

/// SKILL.md 冒頭の YAML frontmatter の内部表現。
/// 認識しないフィールドは読み飛ばす。
#[derive(Debug, Deserialize, Default)]
struct SkillFrontmatter {
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "argument-hint")]
    argument_hint: Option<String>,
    #[serde(rename = "user-invocable", default = "default_true")]
    user_invocable: bool,
}

fn default_true() -> bool {
    true
}

/// `~/.claude/skills/` と `<project_root>/.claude/skills/` をスキャンし、
/// `SKILL.md` の frontmatter をパースして返す。
/// 同名衝突はユーザー側優先でプロジェクト側を除外する。
#[tauri::command]
pub fn list_claude_skills(
    project_root: Option<String>,
) -> Result<Vec<SkillMetadata>, String> {
    let home = dirs::home_dir().ok_or_else(|| "HOME directory not resolvable".to_string())?;
    let user_dir = home.join(".claude").join("skills");

    let mut user_skills = scan_skills_dir(&user_dir, SkillKind::User)?;
    let mut project_skills = match project_root.as_deref() {
        Some(root) => {
            let dir = Path::new(root).join(".claude").join("skills");
            scan_skills_dir(&dir, SkillKind::Project)?
        }
        None => vec![],
    };

    let user_names: std::collections::HashSet<String> =
        user_skills.iter().map(|s| s.name.clone()).collect();
    project_skills.retain(|s| !user_names.contains(&s.name));

    user_skills.append(&mut project_skills);
    Ok(user_skills)
}

fn scan_skills_dir(dir: &Path, kind: SkillKind) -> Result<Vec<SkillMetadata>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut result = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }
        let dir_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        match read_frontmatter(&skill_md) {
            Ok(fm) => {
                if !fm.user_invocable {
                    continue;
                }
                result.push(SkillMetadata {
                    kind: kind.clone(),
                    name: fm.name.unwrap_or(dir_name),
                    description: fm.description,
                    argument_hint: fm.argument_hint,
                    path: skill_md.to_string_lossy().to_string(),
                });
            }
            Err(e) => {
                log::warn!(
                    "Failed to parse SKILL.md frontmatter at {}: {}",
                    skill_md.display(),
                    e
                );
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

fn read_frontmatter(path: &Path) -> Result<SkillFrontmatter, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut lines = content.lines();
    if lines.next() != Some("---") {
        return Ok(SkillFrontmatter::default());
    }
    let mut yaml = String::new();
    for line in lines {
        if line == "---" {
            break;
        }
        yaml.push_str(line);
        yaml.push('\n');
    }
    serde_yaml::from_str::<SkillFrontmatter>(&yaml).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use tempfile::TempDir;

    // `HOME` をテストごとに差し替えるためプロセス全体で逐次化する。
    // cargo test の並列実行でも干渉しないように。
    static HOME_LOCK: Mutex<()> = Mutex::new(());

    fn write_skill(skills_dir: &Path, name: &str, body: &str) {
        let dir = skills_dir.join(name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("SKILL.md"), body).unwrap();
    }

    fn frontmatter(body: &str) -> String {
        format!("---\n{}\n---\n# body\n", body)
    }

    #[test]
    fn reads_user_skills_only() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        let skills = home.path().join(".claude/skills");
        write_skill(&skills, "a", &frontmatter("name: a\ndescription: A"));
        write_skill(&skills, "b", &frontmatter("name: b\ndescription: B"));

        let result = list_claude_skills(None).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|s| s.kind == SkillKind::User));
    }

    #[test]
    fn merges_user_and_project_skills() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        write_skill(
            &home.path().join(".claude/skills"),
            "u1",
            &frontmatter("name: u1"),
        );

        let project = TempDir::new().unwrap();
        write_skill(
            &project.path().join(".claude/skills"),
            "p1",
            &frontmatter("name: p1"),
        );

        let result =
            list_claude_skills(Some(project.path().to_string_lossy().into_owned())).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|s| s.name == "u1" && s.kind == SkillKind::User));
        assert!(result.iter().any(|s| s.name == "p1" && s.kind == SkillKind::Project));
    }

    #[test]
    fn resolves_name_collision_user_wins() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        write_skill(
            &home.path().join(".claude/skills"),
            "dup",
            &frontmatter("name: dup\ndescription: U"),
        );

        let project = TempDir::new().unwrap();
        write_skill(
            &project.path().join(".claude/skills"),
            "dup",
            &frontmatter("name: dup\ndescription: P"),
        );

        let result =
            list_claude_skills(Some(project.path().to_string_lossy().into_owned())).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].kind, SkillKind::User);
        assert_eq!(result[0].description.as_deref(), Some("U"));
    }

    #[test]
    fn excludes_non_user_invocable() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        write_skill(
            &home.path().join(".claude/skills"),
            "hidden",
            &frontmatter("name: hidden\nuser-invocable: false"),
        );
        write_skill(
            &home.path().join(".claude/skills"),
            "visible",
            &frontmatter("name: visible"),
        );

        let result = list_claude_skills(None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "visible");
    }

    #[test]
    fn handles_missing_directory() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        let result = list_claude_skills(None).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn skips_broken_yaml() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        let broken = home.path().join(".claude/skills/broken");
        fs::create_dir_all(&broken).unwrap();
        fs::write(broken.join("SKILL.md"), "---\nname: [unclosed\n---\n").unwrap();
        write_skill(
            &home.path().join(".claude/skills"),
            "ok",
            &frontmatter("name: ok"),
        );

        let result = list_claude_skills(None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "ok");
    }

    #[test]
    fn uses_directory_name_when_frontmatter_has_no_name() {
        let _g = HOME_LOCK.lock().unwrap();
        let home = TempDir::new().unwrap();
        std::env::set_var("HOME", home.path());
        write_skill(
            &home.path().join(".claude/skills"),
            "dir-only",
            &frontmatter("description: only"),
        );

        let result = list_claude_skills(None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "dir-only");
    }
}
