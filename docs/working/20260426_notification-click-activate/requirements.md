# 要件定義書 - notification-click-activate

> 関連 Issue: [#11 OS通知クリックで発信元ウィンドウ・タブをアクティブ化する](https://github.com/sakamotchi/sddesk/issues/11)

## 概要

Claude Code から発火された OS ネイティブ通知（macOS Notification Center / `tauri-plugin-notification`）をクリックした際に、SDDesk 側で以下を自動実行する。

1. **発信元ウィンドウのアクティブ化** — 通知を発火した SDDesk ウィンドウをフォアグラウンドに呼び出し、フォーカスする。
2. **発信元ターミナルタブのアクティブ化** — そのウィンドウ内で、通知を発火した PTY に紐づくターミナルタブを表示する。
3. 必要に応じて **メインモードをターミナルに切り替え** — コンテンツモード表示中であってもターミナルモードに遷移する。

## 背景・目的

現状は以下の課題がある。

- 通知をクリックしてもアプリ全体は前面に来るが、**どのウィンドウ・どのタブで通知が起きたかをユーザーが手動で探す必要がある**。
- 複数ウィンドウ × 複数ターミナルタブで Claude Code を並行運用する開発スタイルでは、承認待ち / エラーへの初動が遅れる。
- 既存の未読マーク（琥珀ドット＋左ボーダー）はタブ位置を視覚的に示すが、それでも探索コストが残る。

`docs/steering/features/notification.md` の通知機能はバックエンド〜未読同期まで実装済みだが、**「クリックで戻る」UX が未対応**であり、本要件はその仕上げとなる。

## 要件一覧

### 機能要件

#### F-1: 通知ペイロードに発信元情報を埋め込む

- **説明**: ネイティブ通知の発火時、発信元の `window_label` と `pty_id` を通知に紐付ける。これらは後続のクリックハンドラで「どこへ戻すか」を解決する一意キーとなる。
- **受け入れ条件**:
  - [ ] OSC 9 経由の通知発火時、その PTY が属するウィンドウラベル（例: `"main"` / `"window-1714123456-ab12c"`）と PTY ID がペイロードに含まれる
  - [ ] HTTP `/claude-hook/{event}` 経由の通知でも、発信元 PTY を解決できた場合は同じ情報がペイロードに含まれる（解決不能時はベストエフォートでウィンドウラベルのみ）
  - [ ] 既存の通知タイトル（`Claude Code — {タブの表示タイトル}`）は維持される

#### F-2: 通知クリックを Rust 側で受け取る

- **説明**: `tauri-plugin-notification` の `on_action` / クリックハンドラ（プラグインが未対応な場合は `notify-rust` などへ乗り換え検討）で、クリックイベントとペイロードを Rust 側にコールバックさせる。
- **受け入れ条件**:
  - [ ] OS 通知をクリックすると Rust 側のハンドラが起動する
  - [ ] ハンドラは F-1 で埋め込んだ `window_label` / `pty_id` を取得できる
  - [ ] macOS / Windows / Linux で挙動を確認する（Linux は `notify-send` ベースの制約により best-effort で良い）

#### F-3: 発信元ウィンドウのフォアグラウンド化

- **説明**: クリックハンドラから対象ウィンドウを `WebviewWindow::set_focus()` + `unminimize()` + `show()` で前面表示する。
- **受け入れ条件**:
  - [ ] 通知発信元のウィンドウラベルでウィンドウを取得し、最小化されていれば復帰する
  - [ ] 別ウィンドウが手前にある状態でクリックしても、発信元ウィンドウが前面に出る
  - [ ] 既存の `is_app_focused()` の `get_webview_window("main")` 決め打ちを廃し、複数ウィンドウ運用に対応する

#### F-4: 発信元ターミナルタブのアクティブ化

- **説明**: 対象ウィンドウのフロントエンドへ `notification-activate` Tauri イベントを emit し、`terminalStore` が該当タブを `setActiveTab` する。コンテンツモード表示中なら `appStore.setActiveMainTab('terminal')` でターミナルモードへ切り替える。
- **受け入れ条件**:
  - [ ] `notification-activate { pty_id }` イベントを対象ウィンドウだけに送信する（全ウィンドウブロードキャストではない）
  - [ ] フロント側で `pty_id` から `(pane, tabId)` を解決し、そのペインで `setActiveTab` を呼ぶ
  - [ ] 分割表示中であれば、該当ペインへ `setFocusedPane` も同時に切り替える
  - [ ] アクティブ化と同時に `clearUnread` で未読マークが解除される
  - [ ] コンテンツモード表示中の場合、ターミナルモードに切り替わってから該当タブが選択される

#### F-5: 既存の通知抑制ロジック維持

- **説明**: 「フォーカス中＋発火元タブがアクティブ」の場合は通知を出さないという既存挙動（`docs/steering/features/notification.md` N-04）を破壊しない。
- **受け入れ条件**:
  - [ ] フォーカス中で発火元タブがアクティブな場合は通知が出ない（既存と同じ）
  - [ ] フォーカス中だが別タブで発火した場合は、通知を出すかどうかは既存挙動を踏襲する
  - [ ] 通知抑制中はクリック → アクティブ化の経路を呼ぶ必要がないため、変更対象外

### 非機能要件

- **パフォーマンス**: 通知クリックからウィンドウフォアグラウンド化まで 500ms 以内（OS 標準のウィンドウ復帰時間内）に完了する。
- **ユーザビリティ**: クリック後にコンテンツモード→ターミナルモードへ自動切替する場合でも、未保存の編集内容（例: コンテンツタブの編集状態）は破棄しない。
- **保守性**: ウィンドウラベルと PTY の対応関係は既存の `PtyManager` を拡張する形で持ち、別ストアを新設しない。
- **クロスプラットフォーム**: macOS は本要件の中心ターゲット。Windows は基本動作確認。Linux は plugin 制約上の動作差異を許容（既知制約として明記）。

## スコープ

### 対象

- `tauri-plugin-notification` のクリックハンドラ調査と実装（不可な場合の代替検討）
- 通知ペイロードへの発信元メタ情報埋め込み（OSC 9 ルートおよび HTTP hook ルート）
- 複数ウィンドウ対応のフォアグラウンド化処理
- フロントエンドのタブアクティブ化リスナーとモード切替
- macOS の手動動作確認＋ 簡易的な Windows / Linux 動作確認

### 対象外

- HTTP `/claude-hook/{event}` 経由の発火に対する `pty_id` 解決の本格実装（cwd 一致や hook 環境変数経由など、**別 Issue 化を許容**。本要件では「解決できた場合のみ pty_id を埋め込む」スコープ）
- 通知の見た目・本文整形の変更（既存仕様を維持）
- 通知履歴 UI / アプリ内通知センターの新設
- 通知音 / バッジカウントなどの追加機能

## 実装対象ファイル（予定）

- `src-tauri/src/commands/notification.rs` — 通知ペイロード拡張、クリックハンドラ、ウィンドウ解決ロジック
- `src-tauri/src/commands/pty.rs` — OSC 9 通知発火時に `window_label` / `pty_id` をペイロードに引き渡し
- `src-tauri/src/lib.rs` — `notification` プラグインのアクション登録、ウィンドウ列挙、`on_action` ハンドラ配線
- `src/lib/tauriApi.ts` — `notification-activate` イベントの型定義とリスナー登録ヘルパー
- `src/components/Layout/AppLayout.tsx` — `notification-activate` リスナー登録、`appStore` / `terminalStore` 経由でアクティブ化
- `src/stores/terminalStore.ts` — `pty_id` から `(pane, tabId)` を逆引きするセレクタ追加（必要に応じて）

## 依存関係

- `docs/steering/features/notification.md` — 既存の通知発火・未読同期フロー
- `docs/steering/features/window-tabs.md` — 複数ウィンドウ運用とラベル管理（macOS タブ統合含む）
- `tauri-plugin-notification` v2 系の `Action` / `on_action` API 対応状況（[Tauri docs](https://tauri.app/) で要確認）

## 既知の制約

- **HTTP hook の `pty_id` 解決**: Claude Code の hook payload に `pty_id` を含める手段がない。本要件では OSC 9 ルートを優先し、HTTP ルートは将来課題として残す。
- **`tauri-plugin-notification` のクリックハンドラ未対応**: プラグインが `Action` ベースの通知をサポートしていない場合は、`notify-rust` 等への乗り換えを検討する。乗り換えに伴う追加調査コストが発生する場合は、別タスクとして切り出す。
- **macOS 通知権限**: クリックハンドラ追加に伴って権限ダイアログが再表示される可能性がある（プロビジョニング更新時）。
- **Tauri Issue #6548 との影響**: macOS タブ統合の既知バグとは別領域だが、ウィンドウラベル管理を共通化するため、`docs/steering/features/window-tabs.md` の制約を再確認する。

## 参考資料

- `docs/steering/features/notification.md` — 通知機能仕様（OSC 9 / HTTP hook / 未読同期）
- `docs/steering/features/window-tabs.md` — macOS ウィンドウタブ統合 / 複数ウィンドウ運用
- `docs/steering/04_repository_structure.md` — ブランチ規則・ディレクトリ構成
- `src-tauri/src/commands/notification.rs` — 既存の通知発火ロジック
- `src-tauri/src/commands/pty.rs:140-185` — OSC 9 検出とイベント発火箇所
- `src/components/Layout/AppLayout.tsx:240-241` — `claude-notification-fired` リスナー登録
