use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileNode>, String> {
    read_dir_single(Path::new(&path)).map_err(|e| e.to_string())
}

// 1階層だけ読む。ディレクトリの children は None（フロントエンドが展開時に遅延読み込み）
fn read_dir_single(dir: &Path) -> Result<Vec<FileNode>, std::io::Error> {
    let mut nodes = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == ".DS_Store" {
            continue;
        }
        let path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type()?.is_dir();
        nodes.push(FileNode {
            name: file_name,
            path,
            is_dir,
            children: None,
        });
    }
    nodes.sort_by(|a, b| {
        // ディレクトリを先に表示
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });
    Ok(nodes)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err(format!("既に存在します: {}", path));
    }
    fs::File::create(&path).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err(format!("既に存在します: {}", path));
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    if Path::new(&new_path).exists() {
        return Err(format!("既に存在します: {}", new_path));
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

// `src` を `dest` 配下へ再帰コピー。dest 自身は新規作成する。
fn copy_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir(dest)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dest.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dest).map(|_| ())
    }
}

#[tauri::command]
pub async fn copy_path(src: String, dest_dir: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let src_path = Path::new(&src);
        let dest_dir_path = Path::new(&dest_dir);

        if !src_path.exists() {
            return Err(format!("コピー元が存在しません: {}", src));
        }
        if !dest_dir_path.exists() {
            return Err(format!("コピー先フォルダが存在しません: {}", dest_dir));
        }

        let name = src_path
            .file_name()
            .ok_or_else(|| format!("コピー元のファイル名を取得できません: {}", src))?;
        let final_path = dest_dir_path.join(name);

        if final_path.exists() {
            return Err(format!("既に存在します: {}", final_path.display()));
        }

        copy_recursive(src_path, &final_path).map_err(|e| e.to_string())?;
        Ok(final_path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| format!("コピー処理に失敗しました: {}", e))?
}

#[tauri::command]
pub fn open_in_editor(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.md").to_string_lossy().to_string();
        assert!(create_file(path.clone()).is_ok());
        assert!(fs::metadata(&path).unwrap().is_file());
    }

    #[test]
    fn test_create_file_already_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.md").to_string_lossy().to_string();
        fs::File::create(&path).unwrap();
        assert!(create_file(path).is_err());
    }

    #[test]
    fn test_create_dir() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("subdir").to_string_lossy().to_string();
        assert!(create_dir(path.clone()).is_ok());
        assert!(fs::metadata(&path).unwrap().is_dir());
    }

    #[test]
    fn test_create_dir_already_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("subdir").to_string_lossy().to_string();
        fs::create_dir(&path).unwrap();
        assert!(create_dir(path).is_err());
    }

    #[test]
    fn test_rename_path() {
        let dir = tempdir().unwrap();
        let old = dir.path().join("old.md").to_string_lossy().to_string();
        let new = dir.path().join("new.md").to_string_lossy().to_string();
        fs::File::create(&old).unwrap();
        assert!(rename_path(old.clone(), new.clone()).is_ok());
        assert!(!Path::new(&old).exists());
        assert!(Path::new(&new).exists());
    }

    #[test]
    fn test_rename_path_target_exists() {
        let dir = tempdir().unwrap();
        let old = dir.path().join("old.md").to_string_lossy().to_string();
        let new = dir.path().join("new.md").to_string_lossy().to_string();
        fs::File::create(&old).unwrap();
        fs::File::create(&new).unwrap();
        assert!(rename_path(old, new).is_err());
    }

    #[test]
    fn test_delete_path_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("del.md").to_string_lossy().to_string();
        fs::File::create(&path).unwrap();
        assert!(delete_path(path.clone()).is_ok());
        assert!(!Path::new(&path).exists());
    }

    #[test]
    fn test_write_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("out.md").to_string_lossy().to_string();
        assert!(write_file(path.clone(), "# hello".to_string()).is_ok());
        assert_eq!(fs::read_to_string(&path).unwrap(), "# hello");
    }

    #[test]
    fn test_write_file_overwrites() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("out.md").to_string_lossy().to_string();
        fs::write(&path, "old content").unwrap();
        assert!(write_file(path.clone(), "new content".to_string()).is_ok());
        assert_eq!(fs::read_to_string(&path).unwrap(), "new content");
    }

    #[test]
    fn test_read_dir_skips_ds_store() {
        let dir = tempdir().unwrap();
        fs::File::create(dir.path().join(".DS_Store")).unwrap();
        fs::File::create(dir.path().join("keep.md")).unwrap();
        let nodes = read_dir(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].name, "keep.md");
    }

    #[tokio::test]
    async fn test_copy_path_file() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("a.md");
        let dest_dir = dir.path().join("dest");
        fs::create_dir(&dest_dir).unwrap();
        fs::write(&src, "hello").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        )
        .await;
        assert!(result.is_ok());
        let final_path = dest_dir.join("a.md");
        assert_eq!(fs::read_to_string(&final_path).unwrap(), "hello");
        assert!(src.exists()); // コピーなので元は残る
        assert_eq!(result.unwrap(), final_path.to_string_lossy());
    }

    #[tokio::test]
    async fn test_copy_path_directory_recursive() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        let dest_dir = dir.path().join("dest");
        fs::create_dir(&src).unwrap();
        fs::create_dir(src.join("sub")).unwrap();
        fs::create_dir(&dest_dir).unwrap();
        fs::write(src.join("a.txt"), "x").unwrap();
        fs::write(src.join("sub/b.txt"), "y").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        )
        .await;
        assert!(result.is_ok());
        assert!(dest_dir.join("src/a.txt").exists());
        assert_eq!(fs::read_to_string(dest_dir.join("src/sub/b.txt")).unwrap(), "y");
    }

    #[tokio::test]
    async fn test_copy_path_conflict_errors() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("a.md");
        let dest_dir = dir.path().join("dest");
        fs::create_dir(&dest_dir).unwrap();
        fs::write(&src, "x").unwrap();
        fs::write(dest_dir.join("a.md"), "old").unwrap();

        let result = copy_path(
            src.to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        )
        .await;
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(dest_dir.join("a.md")).unwrap(), "old");
    }

    #[tokio::test]
    async fn test_copy_path_missing_source() {
        let dir = tempdir().unwrap();
        let dest_dir = dir.path().join("dest");
        fs::create_dir(&dest_dir).unwrap();
        let result = copy_path(
            dir.path().join("missing.md").to_string_lossy().into_owned(),
            dest_dir.to_string_lossy().into_owned(),
        )
        .await;
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_path_dir_recursive() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::File::create(sub.join("file.txt")).unwrap();
        let path = sub.to_string_lossy().to_string();
        assert!(delete_path(path.clone()).is_ok());
        assert!(!Path::new(&path).exists());
    }
}
