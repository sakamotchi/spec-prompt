use std::collections::HashMap;
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GitFileStatus {
    /// ステージング領域のステータス (' ', 'M', 'A', 'D', 'R', '?')
    pub staged: char,
    /// ワーキングツリーのステータス (' ', 'M', 'D', '?')
    pub unstaged: char,
}

/// `git status --porcelain=v1` の出力をパースする
pub fn parse_porcelain(output: &str, cwd: &str) -> HashMap<String, GitFileStatus> {
    let mut statuses = HashMap::new();
    let cwd_prefix = if cwd.ends_with('/') {
        cwd.to_string()
    } else {
        format!("{}/", cwd)
    };

    for line in output.lines() {
        if line.len() < 3 {
            continue;
        }
        let bytes = line.as_bytes();
        let staged = bytes[0] as char;
        let unstaged = bytes[1] as char;
        let path_str = &line[3..];

        // リネーム: "old -> new" 形式 → new のパスを使う
        let path = if let Some(idx) = path_str.find(" -> ") {
            &path_str[idx + 4..]
        } else {
            path_str
        };

        let full_path = format!("{}{}", cwd_prefix, path);
        statuses.insert(full_path, GitFileStatus { staged, unstaged });
    }

    statuses
}

#[tauri::command]
pub fn git_status(cwd: String) -> Result<HashMap<String, GitFileStatus>, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v1", "-uall"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        // Git リポジトリでない場合など
        return Ok(HashMap::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_porcelain(&stdout, &cwd))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_modified_unstaged() {
        let output = " M src/main.rs\n";
        let result = parse_porcelain(output, "/project");
        let status = result.get("/project/src/main.rs").unwrap();
        assert_eq!(status.staged, ' ');
        assert_eq!(status.unstaged, 'M');
    }

    #[test]
    fn test_parse_modified_staged() {
        let output = "M  src/main.rs\n";
        let result = parse_porcelain(output, "/project");
        let status = result.get("/project/src/main.rs").unwrap();
        assert_eq!(status.staged, 'M');
        assert_eq!(status.unstaged, ' ');
    }

    #[test]
    fn test_parse_added() {
        let output = "A  new_file.txt\n";
        let result = parse_porcelain(output, "/project");
        let status = result.get("/project/new_file.txt").unwrap();
        assert_eq!(status.staged, 'A');
        assert_eq!(status.unstaged, ' ');
    }

    #[test]
    fn test_parse_deleted() {
        let output = " D old_file.txt\n";
        let result = parse_porcelain(output, "/project");
        let status = result.get("/project/old_file.txt").unwrap();
        assert_eq!(status.staged, ' ');
        assert_eq!(status.unstaged, 'D');
    }

    #[test]
    fn test_parse_untracked() {
        let output = "?? untracked.txt\n";
        let result = parse_porcelain(output, "/project");
        let status = result.get("/project/untracked.txt").unwrap();
        assert_eq!(status.staged, '?');
        assert_eq!(status.unstaged, '?');
    }

    #[test]
    fn test_parse_renamed() {
        let output = "R  old.txt -> new.txt\n";
        let result = parse_porcelain(output, "/project");
        assert!(result.get("/project/old.txt").is_none());
        let status = result.get("/project/new.txt").unwrap();
        assert_eq!(status.staged, 'R');
        assert_eq!(status.unstaged, ' ');
    }

    #[test]
    fn test_parse_multiple() {
        let output = " M src/a.rs\nA  src/b.rs\n?? src/c.rs\n";
        let result = parse_porcelain(output, "/project");
        assert_eq!(result.len(), 3);
        assert_eq!(result.get("/project/src/a.rs").unwrap().unstaged, 'M');
        assert_eq!(result.get("/project/src/b.rs").unwrap().staged, 'A');
        assert_eq!(result.get("/project/src/c.rs").unwrap().staged, '?');
    }

    #[test]
    fn test_parse_empty() {
        let result = parse_porcelain("", "/project");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_cwd_trailing_slash() {
        let output = " M file.txt\n";
        let result = parse_porcelain(output, "/project/");
        assert!(result.contains_key("/project/file.txt"));
    }
}
