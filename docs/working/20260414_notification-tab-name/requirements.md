# 要件定義書 - notification-tab-name（P1: 通知タイトルへのタブ識別子差し込み）

## 概要

SpecPrompt の統合ターミナルで OSC 9 経由で Claude Code から発火される OS 通知（macOS デスクトップ通知）のタイトルに、発火元のターミナルタブを識別する名前を差し込む。複数タブで Claude Code を並行実行しているときに、どのタブの通知か即判別できるようにする。

本ドキュメントは 4 フェーズ計画のうち **Phase 1** を対象とする。Phase 1 ではタブ名の取得源として現在の Zustand 既存タイトル（`Terminal 1`, `Terminal 2` のフォールバック連番 or 手動リネーム後の表示名）を使用する。OSC 0/1/2 による動的タイトル更新および未読マーク UI は Phase 2/4 の対象であり、本フェーズには含めない。

## 背景・目的

- 直前のリリース（v0.1.11 / `docs/local/20260413-claude-code通知機能`）で OSC 9 検出による OS 通知が実装された。
- 通知タイトルは現在 `"SpecPrompt / Claude Code"` 固定で（`src-tauri/src/commands/pty.rs:149`）、どのタブから発火したか判別できない。
- 複数タブで Claude Code を同時運用する場面（レビュー・ビルド監視と並行した承認対応など）で実用上の困難が生じている。
- Phase 1 として「Rust 側に `pty_id → 表示タイトル` のキャッシュを持ち、通知発火時にそれを差し込む」基盤を作る。この基盤は後続の Phase 2〜4 でもそのまま再利用される。

## 要件一覧

### 機能要件

#### F-1: 通知タイトルへのタブ名差し込み

- **説明**:
  OSC 9 検出時に発火する OS 通知のタイトルに、発火元タブの表示名を含める。フォーマットは `Claude Code — <タブ名>`。キャッシュ未登録時は従来どおり `SpecPrompt / Claude Code` にフォールバックする。
- **受け入れ条件**:
  - [ ] 2 つのタブを開き、それぞれで `claude` を実行し承認要求を出させたとき、OS 通知のタイトルにそれぞれのタブ名（例: `Claude Code — Terminal 1` / `Claude Code — Terminal 2`）が含まれる
  - [ ] 通知本文（OSC 9 メッセージ）は従来どおり正しく表示される
  - [ ] 通知設定 OFF のときは OS 通知が出ない（既存挙動を維持）
  - [ ] アプリがフォーカス中のときは通知が抑制される（既存挙動を維持）

#### F-2: Rust 側 DisplayTitleCache の導入

- **説明**:
  Tauri の `State` として `pty_id → 表示タイトル` を保持するキャッシュ（`DisplayTitleCache`）を導入する。`set` / `get` / `remove` を提供し、PTY クローズ時にエントリを掃除する。
- **受け入れ条件**:
  - [ ] Tauri 起動時に `DisplayTitleCache` が `manage` 登録される
  - [ ] `close_pty` の呼び出しで該当 `pty_id` のエントリが削除される
  - [ ] 複数の PTY が同時稼働してもエントリが混線しない（競合安全）

#### F-3: `set_pty_display_title` コマンド

- **説明**:
  フロントエンドから Rust 側キャッシュに表示タイトルを書き込むための Tauri コマンドを追加する。フロントは PTY スポーン直後（ptyId 確定時）、およびタブの表示タイトル変化時に本コマンドを呼ぶ。
- **受け入れ条件**:
  - [ ] `invoke("set_pty_display_title", { ptyId, title })` で Rust キャッシュが更新される
  - [ ] 不明な `ptyId` が渡されてもエラーにならず、該当エントリが追加される（後から PTY が登録される順序にも耐える）

#### F-4: フロントからの初期同期

- **説明**:
  `spawnPty` が返した `ptyId` を `TerminalTab.ptyId` に設定するタイミングで、`TerminalTab.title`（現行の表示タイトル）を `set_pty_display_title` で Rust に送る。リネームアクションが既に存在する場合はその完了時にも送る。
- **受け入れ条件**:
  - [ ] タブ新規作成 → PTY スポーン直後に Rust キャッシュにエントリがある
  - [ ] `TerminalTab.title` が変化した場合（既存の更新経路があれば）Rust キャッシュも追随する
  - [ ] タブを閉じると Rust キャッシュからエントリが消える（F-2 と連動）

### 非機能要件

- **パフォーマンス**:
  - 通知発火時のキャッシュ参照は `HashMap` ルックアップ 1 回のみ。PTY 出力ストリームの処理を阻害しない。
  - `set_pty_display_title` は同一タイトルの連続呼び出しに耐える（書き込みは単純に上書き）。
- **ユーザビリティ**:
  - ユーザーの追加操作は不要。既存タブ名がそのまま通知に反映される。
- **保守性**:
  - `DisplayTitleCache` は Phase 2（OSC 0/1/2 連動）と Phase 4（未読マーク）から再利用できる形にする（専用構造体 + `tauri::State` 管理）。
  - キャッシュ操作は `Mutex` による単純な排他で十分（読み取り頻度 < 更新頻度、ロック保持時間はマイクロ秒オーダー）。
- **外観・デザイン**: 本フェーズでは UI 変更なし。

## スコープ

### 対象

- Rust: `DisplayTitleCache` 構造体、`set_pty_display_title` コマンド、`pty.rs` の通知送信箇所の差し替え、`close_pty` でのキャッシュ掃除
- Front: `tauriApi.setPtyDisplayTitle` の追加、`terminalStore` で PTY 紐付け時／タイトル変化時の Rust 同期
- テスト: Rust ユニットテスト（キャッシュの set/get/remove）、手動 E2E

### 対象外

- OSC 0/1/2 によるタブタイトルの自動更新（Phase 2）
- タブの手動リネーム UI（ダブルクリック編集、右クリックメニュー）（Phase 3）
- 未読マーク（`●`）およびタブハイライト / 解除ロジック（Phase 4）
- 通知アイコンや通知音のカスタマイズ
- Claude Code 以外のエージェントに対する識別

## 実装対象ファイル（予定）

- `src-tauri/src/commands/notification.rs` — `DisplayTitleCache` 構造体と `set_pty_display_title` コマンド追加
- `src-tauri/src/commands/pty.rs` — 通知送信時にキャッシュ参照、`close_pty` でキャッシュ掃除
- `src-tauri/src/lib.rs` — `.manage(DisplayTitleCache::new())` 追加、コマンド登録
- `src/lib/tauriApi.ts` — `setPtyDisplayTitle` メソッド追加
- `src/stores/terminalStore.ts`（または PTY スポーン呼び出し箇所）— PTY 紐付け時に Rust 同期
- `src/components/TerminalPanel/TerminalPanel.tsx`（spawnPty 呼び出し箇所） — 必要なら初期同期フック追加

## 依存関係

- 既存の OSC 9 通知実装（`src-tauri/src/commands/notification.rs`、`src-tauri/src/commands/pty.rs:144-152`）
- `tauri-plugin-notification`
- 既存の `TerminalTab.title` フィールド（`src/stores/terminalStore.ts`）

## 既知の制約

- Phase 1 時点では Rust 側キャッシュの更新はフロント起点（`invoke`）のみ。OSC 由来の自動更新は Phase 2 で追加する。
- タブ名の表示形式は現行の連番（`Terminal 1`）または手動タイトルに依存する。ユーザーがタブをリネームする UI は Phase 3 まで未提供のため、本フェーズで通知上に見える名前は基本 `Terminal N` 形式となる。
- フロント → Rust の同期 `invoke` は非同期のため、PTY スポーン直後に通知が即発火する競合では一瞬タイトル未設定になりうる。その場合はフォールバック（`SpecPrompt / Claude Code`）が使われる。実害なしと判断。

## 参考資料

- `docs/local/20260414-タブ識別通知と動的タブタイトル/01_要件定義書.md` — 全体要件（FR-01, FR-04 が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/02_概要設計書.md` — 全体設計（3-1, 3-2, 3-4 の一部が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/03_WBS.md` — フェーズ分割と見積（Phase 1 セクション）
- `docs/local/20260413-claude-code通知機能/` — 既存 OSC 9 通知機能の要件・設計
