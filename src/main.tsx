import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";
import { useSettingsStore } from "./stores/settingsStore";
import { useAppStore } from "./stores/appStore";
import i18n from "./i18n";
import { loadWindowSessions, clearWindowSessions } from "./lib/windowSession";
import { tauriApi } from "./lib/tauriApi";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('React error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#f88', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {String(this.state.error)}
        </div>
      )
    }
    return this.props.children
  }
}

useSettingsStore.getState().loadSettings().catch(console.error)

// macOS 通知権限をリクエスト（初回のみダイアログが出る）
isPermissionGranted().then((granted) => {
  if (!granted) requestPermission().catch(console.error)
})

// 通知は Rust 側で osascript 経由で送信するため、JS 側のリスナーは不要
i18n.changeLanguage(useSettingsStore.getState().language)

// 新規ウィンドウとして起動されたとき、URL クエリパラメータを読み取る
const params = new URLSearchParams(window.location.search)
const initialProject = params.get('project')
const isNewEmptyWindow = params.has('new')

if (initialProject) {
  // フォルダ指定で起動された場合はそのプロジェクトを開く
  useAppStore.getState().switchProject(initialProject)
} else if (isNewEmptyWindow) {
  // 空ウィンドウとして起動された場合は localStorage の projectRoot をクリア
  useAppStore.setState({
    projectRoot: null,
    fileTree: [],
    expandedDirs: new Set(),
    selectedFile: null,
    selectedFiles: [],
    editingState: null,
    creatingState: null,
    docStatuses: {},
  })
} else {
  // メインウィンドウ起動: 前回セッションの追加ウィンドウを復元
  const sessions = loadWindowSessions()
  clearWindowSessions()  // セッションはウィンドウが開かれるたびに再構築される
  
  // メインウィンドウ自身の前回セッションを取り出して復元する（Zustand の Persist を上書きするため）
  const mainIndex = sessions.findIndex(s => s.label === 'main')
  if (mainIndex !== -1) {
    const [mainSession] = sessions.splice(mainIndex, 1)
    if (mainSession.projectRoot) {
      useAppStore.getState().switchProject(mainSession.projectRoot)
    } else {
      useAppStore.setState({
        projectRoot: null, fileTree: [], expandedDirs: new Set(),
        selectedFile: null, selectedFiles: [], editingState: null, creatingState: null, docStatuses: {}
      })
    }
  }

  for (const session of sessions) {
    tauriApi.openNewWindow(session.projectRoot ?? undefined)
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
