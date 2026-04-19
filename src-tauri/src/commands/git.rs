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

/// 指定 cwd の現在ブランチ名を取得する。
/// - 通常ブランチ: `Ok(Some("main"))` のように返す
/// - detached HEAD: 短縮 SHA を `Ok(Some("1a2b3c4"))` のように返す
/// - Git リポジトリでない / `git` 未インストール / 実行失敗: `Ok(None)`
#[tauri::command]
pub fn git_branch(cwd: String) -> Result<Option<String>, String> {
    let output = match Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
    {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };

    if !output.status.success() {
        return Ok(None);
    }

    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        return Ok(None);
    }

    if name == "HEAD" {
        // detached HEAD → 短縮 SHA を返す
        let short = match Command::new("git")
            .args(["rev-parse", "--short", "HEAD"])
            .current_dir(&cwd)
            .output()
        {
            Ok(o) => o,
            Err(_) => return Ok(None),
        };
        if !short.status.success() {
            return Ok(None);
        }
        let sha = String::from_utf8_lossy(&short.stdout).trim().to_string();
        return Ok(if sha.is_empty() { None } else { Some(sha) });
    }

    Ok(Some(name))
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

    // ===== git_branch のテスト =====

    fn init_repo(dir: &std::path::Path) {
        let ok = |args: &[&str]| {
            assert!(
                Command::new("git")
                    .args(args)
                    .current_dir(dir)
                    .status()
                    .unwrap()
                    .success()
            );
        };
        ok(&["init", "-q", "-b", "main"]);
        std::fs::write(dir.join("README.md"), "x").unwrap();
        ok(&["add", "."]);
        ok(&[
            "-c",
            "user.email=t@example.com",
            "-c",
            "user.name=t",
            "commit",
            "-qm",
            "init",
        ]);
    }

    #[test]
    fn test_git_branch_returns_branch_name() {
        let td = tempfile::TempDir::new().unwrap();
        init_repo(td.path());
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(result, Some("main".to_string()));
    }

    #[test]
    fn test_git_branch_detached_returns_short_sha() {
        let td = tempfile::TempDir::new().unwrap();
        init_repo(td.path());
        let sha_out = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(td.path())
            .output()
            .unwrap();
        let sha_full = String::from_utf8_lossy(&sha_out.stdout).trim().to_string();
        assert!(
            Command::new("git")
                .args(["checkout", "-q", &sha_full])
                .current_dir(td.path())
                .status()
                .unwrap()
                .success()
        );
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert!(result.is_some(), "detached HEAD では短縮 SHA を返すはず");
        let name = result.unwrap();
        assert_ne!(name, "HEAD", "HEAD 文字列のままになってはいけない");
        assert!(
            sha_full.starts_with(&name),
            "短縮 SHA は full SHA の接頭辞であるはず: name={}, full={}",
            name,
            sha_full
        );
    }

    #[test]
    fn test_git_branch_non_repo_returns_none() {
        let td = tempfile::TempDir::new().unwrap();
        let result = git_branch(td.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(result, None);
    }
}
