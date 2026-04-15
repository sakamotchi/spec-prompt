import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
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

// terminal-cells イベントの型定義（Rust 側の TerminalCellsPayload と対応）
export interface TerminalCellsPayload {
  id: string;
  cells: CellData[];
  cursor: { row: number; col: number };
  /** 現在のスクロール行数（0=末尾、正=上方向にスクロール済み） */
  scroll_offset: number;
  /** スクロールバック履歴の総行数 */
  scrollback_len: number;
}

export interface CellData {
  row: number;
  col: number;
  ch: string;
  wide: boolean;
  fg: ColorData;
  bg: ColorData;
  flags: CellFlags;
}

export type ColorData =
  | { type: 'Named'; value: number }
  | { type: 'Indexed'; value: number }
  | { type: 'Rgb'; value: { r: number; g: number; b: number } }
  | { type: 'Default'; value: null };

export interface CellFlags {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeout: boolean;
  inverse: boolean;
  dim: boolean;
}

// terminal-title-changed イベントの型定義（Rust 側の TitleChangedPayload と対応）
export interface TerminalTitleChangedPayload {
  pty_id: string;
  title: string | null;
}

// claude-notification-fired イベントの型定義（非フォーカス時に OS 通知が発火したタイミング）
export interface ClaudeNotificationFiredPayload {
  pty_id: string;
}

// pty-exited イベントの型定義（シェル終了などで PTY の読取ループが終了したタイミング）
export interface PtyExitedPayload {
  id: string;
}

export const tauriApi = {
  // PTY
  spawnPty: (shell: string, cwd: string, notificationEnabled: boolean): Promise<string> =>
    invoke("spawn_pty", { shell, cwd, notificationEnabled }),

  writePty: (id: string, data: string): Promise<void> =>
    invoke("write_pty", { id, data }),

  resizePty: (id: string, cols: number, rows: number): Promise<void> =>
    invoke("resize_pty", { id, cols, rows }),

  closePty: (id: string): Promise<void> => invoke("close_pty", { id }),

  setPtyDisplayTitle: (ptyId: string, title: string): Promise<void> =>
    invoke("set_pty_display_title", { ptyId, title }),

  onPtyOutput: (callback: (output: PtyOutput) => void): Promise<UnlistenFn> =>
    listen<PtyOutput>("pty-output", (event) => callback(event.payload)),

  resizeTerminal: (id: string, cols: number, rows: number): Promise<void> =>
    invoke("resize_terminal", { id, cols, rows }),

  scrollTerminal: (id: string, delta: number): Promise<void> =>
    invoke("scroll_terminal", { id, delta }),

  onTerminalCells: (callback: (payload: TerminalCellsPayload) => void): Promise<UnlistenFn> =>
    listen<TerminalCellsPayload>("terminal-cells", (event) => callback(event.payload)),

  onTerminalTitleChanged: (
    callback: (payload: TerminalTitleChangedPayload) => void,
  ): Promise<UnlistenFn> =>
    listen<TerminalTitleChangedPayload>("terminal-title-changed", (event) =>
      callback(event.payload),
    ),

  onClaudeNotificationFired: (
    callback: (payload: ClaudeNotificationFiredPayload) => void,
  ): Promise<UnlistenFn> =>
    listen<ClaudeNotificationFiredPayload>("claude-notification-fired", (event) =>
      callback(event.payload),
    ),

  onPtyExited: (callback: (payload: PtyExitedPayload) => void): Promise<UnlistenFn> =>
    listen<PtyExitedPayload>("pty-exited", (event) => callback(event.payload)),

  // Filesystem
  readDir: (path: string): Promise<FileNode[]> =>
    invoke("read_dir", { path }),

  readFile: (path: string): Promise<string> => invoke("read_file", { path }),

  writeFile: (path: string, content: string): Promise<void> =>
    invoke("write_file", { path, content }),

  createFile: (path: string): Promise<void> => invoke("create_file", { path }),

  createDir: (path: string): Promise<void> => invoke("create_dir", { path }),

  renamePath: (oldPath: string, newPath: string): Promise<void> =>
    invoke("rename_path", { oldPath, newPath }),

  copyPath: (src: string, destDir: string): Promise<string> =>
    invoke("copy_path", { src, destDir }),

  deletePath: (path: string): Promise<void> => invoke("delete_path", { path }),

  openInEditor: (path: string): Promise<void> => invoke("open_in_editor", { path }),

  openFolderDialog: (): Promise<string | null> =>
    open({ directory: true, multiple: false }).then((result) =>
      typeof result === "string" ? result : null
    ),

  // Window management
  openNewWindow: (projectPath?: string): void => {
    const label = `window-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const url = projectPath
      ? `index.html?project=${encodeURIComponent(projectPath)}`
      : 'index.html?new=1'
    const win = new WebviewWindow(label, {
      url,
      title: 'SpecPrompt',
      width: 1200,
      height: 800,
      resizable: true,
    })
    win.once('tauri://error', (e) => console.error('Failed to create window:', e))
  },

  // Config
  getRecentProjects: (): Promise<string[]> =>
    invoke("get_recent_projects"),

  addRecentProject: (path: string): Promise<void> =>
    invoke("add_recent_project", { path }),

  getAppearance: (): Promise<AppearanceSettings> =>
    invoke("get_appearance"),

  saveAppearance: (settings: AppearanceSettings): Promise<void> =>
    invoke("save_appearance", { settings }),

  loadFontBytes: (family: string): Promise<number[]> =>
    invoke("load_font_bytes", { family }),

  // Git
  getGitStatus: (cwd: string): Promise<Record<string, GitFileStatus>> =>
    invoke("git_status", { cwd }),
};

export interface GitFileStatus {
  staged: string
  unstaged: string
}

export interface AppearanceSettings {
  theme: string;
  content_font_family: string;
  content_font_size: number;
  terminal_font_family: string;
  terminal_font_size: number;
}
