import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[] | null; // null = 未読み込み（ディレクトリのみ）、[] = 読み込み済み空
}

export interface PtyOutput {
  id: string;
  data: string;
}

export const tauriApi = {
  // PTY
  spawnPty: (shell: string, cwd: string): Promise<string> =>
    invoke("spawn_pty", { shell, cwd }),

  writePty: (id: string, data: string): Promise<void> =>
    invoke("write_pty", { id, data }),

  resizePty: (id: string, cols: number, rows: number): Promise<void> =>
    invoke("resize_pty", { id, cols, rows }),

  closePty: (id: string): Promise<void> => invoke("close_pty", { id }),

  onPtyOutput: (callback: (output: PtyOutput) => void): Promise<UnlistenFn> =>
    listen<PtyOutput>("pty-output", (event) => callback(event.payload)),

  // Filesystem
  readDir: (path: string): Promise<FileNode[]> =>
    invoke("read_dir", { path }),

  readFile: (path: string): Promise<string> => invoke("read_file", { path }),

  createFile: (path: string): Promise<void> => invoke("create_file", { path }),

  createDir: (path: string): Promise<void> => invoke("create_dir", { path }),

  renamePath: (oldPath: string, newPath: string): Promise<void> =>
    invoke("rename_path", { oldPath, newPath }),

  deletePath: (path: string): Promise<void> => invoke("delete_path", { path }),

  openInEditor: (path: string): Promise<void> => invoke("open_in_editor", { path }),

  openFolderDialog: (): Promise<string | null> =>
    open({ directory: true, multiple: false }).then((result) =>
      typeof result === "string" ? result : null
    ),
};
