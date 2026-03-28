use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileNode>, String> {
    let dir = Path::new(&path);
    read_dir_recursive(dir).map_err(|e| e.to_string())
}

fn read_dir_recursive(dir: &Path) -> Result<Vec<FileNode>, std::io::Error> {
    let mut nodes = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy().to_string();


        let path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type()?.is_dir();
        let children = if is_dir {
            Some(read_dir_recursive(&entry.path()).unwrap_or_default())
        } else {
            None
        };

        nodes.push(FileNode {
            name: file_name,
            path,
            is_dir,
            children,
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
