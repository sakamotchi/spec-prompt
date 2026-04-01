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
