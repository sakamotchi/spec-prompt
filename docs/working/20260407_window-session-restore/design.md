# 設計書 - Phase 3-H: ウィンドウセッション復元

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  ├── src/main.tsx              — 起動時にセッション復元を実行
  ├── src/lib/windowSession.ts  — セッション保存・読み取りユーティリティ（新規）
  └── src/components/TreePanel/TreePanel.tsx
                                — ウィンドウ閉じイベントのフック
```

Rust バックエンドへの変更は不要。localStorage と Tauri v2 の `WebviewWindow` API および `onCloseRequested` のみを使用する。

### 影響範囲

- **フロントエンド**: `main.tsx`（起動時復元）、`TreePanel.tsx`（ウィンドウ閉じイベント）、新規 `windowSession.ts`
- **バックエンド（Rust）**: 変更なし

---

## 実装方針

### 概要

localStorage キー `specprompt-window-sessions` に、メインウィンドウ以外（追加ウィンドウ）の `projectRoot` リストを保存する。
メインウィンドウ起動時にリストを読み取り、`WebviewWindow` で復元する。

### 詳細

1. **ウィンドウセッションユーティリティ（`windowSession.ts`）**
   - `saveWindowSessions(sessions: WindowSession[])` — localStorage への書き込み
   - `loadWindowSessions(): WindowSession[]` — localStorage からの読み取り
   - `clearWindowSessions()` — セッション情報のクリア
   - 書き込み・読み取りは同期処理で行い、非同期フローの複雑化を避ける

2. **ウィンドウ開閉時のセッション更新（`TreePanel.tsx`）**
   - `tauriApi.openNewWindow()` 呼び出し後にセッションを追加
   - `getCurrentWindow().onCloseRequested()` でウィンドウ閉じイベントをフック
   - ただし、メインウィンドウ（label = `"main"`）はセッション管理対象外とする
   - 追加ウィンドウのみ `getCurrentWindow().label` でフィルタリングして管理する

3. **起動時の復元（`main.tsx`）**
   - `?project=` / `?new=1` クエリパラメータが**ない**かつ追加ウィンドウでない場合のみ復元を実行（= メインウィンドウ起動時のみ）
   - `loadWindowSessions()` でセッション一覧を取得
   - 各セッションに対し `tauriApi.openNewWindow(session.projectRoot ?? undefined)` を呼び出す
   - 存在しないパスの判定は、開かれた追加ウィンドウ側で `?project=` パラメータを受け取った際に `read_dir` が失敗した場合に自動的に空の状態になるため、メインウィンドウ側では検証しない

4. **セッション管理のタイミング整理**

   | タイミング | 処理 |
   |-----------|------|
   | 追加ウィンドウが開かれる | セッションに `projectRoot` を追加 |
   | 追加ウィンドウが閉じられる | セッションから対象エントリを削除 |
   | メインウィンドウ起動時 | セッションを読み取って復元 |
   | メインウィンドウが閉じられる | セッションをクリア（全ウィンドウが閉じる）|

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/windowSession.ts

interface WindowSession {
  projectRoot: string | null  // null = 空ウィンドウ
}

const SESSION_KEY = 'specprompt-window-sessions'

export function saveWindowSessions(sessions: WindowSession[]): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions))
}

export function loadWindowSessions(): WindowSession[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WindowSession[]
  } catch {
    return []
  }
}

export function clearWindowSessions(): void {
  localStorage.removeItem(SESSION_KEY)
}
```

---

## API設計

### Tauriコマンド

追加なし。既存の `WebviewWindow`（`@tauri-apps/api/webviewWindow`）と `getCurrentWindow()`（`@tauri-apps/api/window`）の API を使用する。

### Tauriイベント

追加なし。

---

## UI設計

UIの変更はなし。復元処理はバックグラウンドで自動的に行われる。

---

## 状態管理

Zustand ストアへの変更はなし。セッション情報は localStorage に直接保存する（Zustand persist とは独立したキーを使用）。

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| localStorage に直接保存（Zustand 外） | セッション情報はウィンドウ間で共有が必要。Zustand persist は各ウィンドウのインスタンス固有の状態に使用しており、混在させると複雑になる | Rust の config.json に保存（IPC が必要で複雑化する） |
| 追加ウィンドウのみ管理（メインウィンドウを除外） | メインウィンドウは Tauri が自動起動するため、セッションに含める必要がない | 全ウィンドウをセッション管理（メインウィンドウの取り扱いが複雑になる） |
| パス検証をしない（フォールバックのみ） | 存在確認のために `read_dir` を同期で呼ぶか IPC を増やす必要があり複雑化する。復元ウィンドウが空になるだけで実害は少ない | 起動時に存在確認して復元スキップ |
| 競合制御なし（初期実装） | 複数ウィンドウが同時に localStorage を書き換えるケースは稀。初期実装では許容し、問題が顕在化したときに対応する | Mutex 相当の排他制御（フロントエンドで実装困難） |

## 未解決事項

- [ ] 強制終了（Cmd+Q / kill）時のセッション保存方法。現時点では未対応とする
