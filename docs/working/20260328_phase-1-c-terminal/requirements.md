# 要件定義書 - Phase 1-C: 統合ターミナル（TerminalPanel）

## 概要

右ペインのターミナルタブに、複数ターミナルセッションをタブで管理できる `TerminalTabs` コンポーネントを実装する。PTY の起動・入出力・リサイズ・クローズは Phase 0-E で実装済みのため、Phase 1-C では**タブ UI と状態管理**の実装が主な作業となる。

## 背景・目的

Phase 0-E で単一ターミナル（`TerminalPanel.tsx`）の動作が確認済み。Phase 1-C でタブ管理を加えることで、複数のシェルセッションを同時に扱えるようになり、Phase 2-D（パス挿入）や Phase 2-C（分割表示）の土台が整う。

## 要件一覧

### 機能要件

#### F-1: 複数ターミナルタブ管理

- **説明**: 複数のターミナルセッションをタブで管理する
- **受け入れ条件**:
  - [ ] 「+」ボタンをクリックすると新しいターミナルタブが開く
  - [ ] タブをクリックするとアクティブなターミナルが切り替わる
  - [ ] 「×」ボタンでタブを閉じる（対応する PTY が終了する）
  - [ ] タブ名はデフォルト「Terminal 1」「Terminal 2」… の連番
  - [ ] 最低 1 タブは常に存在する（最後の 1 タブは閉じられない）

#### F-2: ターミナルタブの初期起動

- **説明**: アプリ起動時にターミナルタブが 1 つ自動で開く
- **受け入れ条件**:
  - [ ] `MainArea` の「ターミナル」タブを選択した時点で、タブが 1 つ起動した状態になっている
  - [ ] PTY は `/bin/zsh`、cwd はホームディレクトリ（`~`）で起動する

#### F-3: タブ切り替え時のターミナル保持

- **説明**: タブ切り替え時に各ターミナルの表示内容が失われない
- **受け入れ条件**:
  - [ ] タブを切り替えても、各ターミナルの出力履歴が保持される
  - [ ] 非アクティブタブの PTY は引き続き動作している（バックグラウンド実行）

#### F-4: ターミナルリサイズ

- **説明**: ペイン幅変更時に PTY サイズが追従する
- **受け入れ条件**:
  - [ ] `SplitPane` のドラッグリサイズ時にターミナルの表示幅が自動調整される
  - [ ] `FitAddon` による自動 fit が動作する

### 非機能要件

- **パフォーマンス**: 非アクティブタブの `TerminalPanel` は DOM から除去せず、`visibility: hidden` / `display: none` で非表示にして PTY セッションを維持する
- **外観・デザイン**: タブバーは `MainTabs`（コンテンツ/ターミナル切り替え）の下にネストする形で配置。カラーパレット CSS カスタムプロパティを使用

## スコープ

### 対象

- `src/stores/terminalStore.ts`（新規）
- `src/components/TerminalPanel/TerminalTabs.tsx`（新規）
- `src/components/TerminalPanel/TerminalPanel.tsx`（既存・props 追加）
- `src/components/MainArea/MainArea.tsx`（`TerminalTabs` を組み込み）

### 対象外

- ターミナルの水平/垂直分割（Phase 2-C）
- `Ctrl+W` によるタブクローズ（Phase 3-C）
- カレントディレクトリのタブ名表示（Phase 2 以降）
- Zustand persist によるセッション復元（Phase 1-D）

## 実装対象ファイル（予定）

- `src/stores/terminalStore.ts`（新規）
- `src/components/TerminalPanel/TerminalTabs.tsx`（新規）
- `src/components/TerminalPanel/TerminalPanel.tsx`（props 拡張）
- `src/components/TerminalPanel/index.ts`（新規 or 更新）
- `src/components/MainArea/MainArea.tsx`（TerminalTabs に差し替え）

## 依存関係

- Phase 0-E が完了していること（`spawn_pty` / `write_pty` / `resize_pty` / `close_pty` 実装済み）
- Phase 1-A が完了していること（`MainArea` の「ターミナル」タブが存在する）
- `@xterm/xterm` / `@xterm/addon-fit` は Phase 0-E でインストール済み

## 既知の制約

- xterm.js の `Terminal` インスタンスは DOM にマウントされた後でないと `fit()` が正しく動作しない。非表示タブでは `display:none` ではなく `visibility:hidden` + `position:absolute` を使うか、表示時に `fit()` を再実行する必要がある
- PTY 出力の Tauri イベント `pty-output` はすべてのターミナルに届くため、`output.id === ptyId` でフィルタリングする（既存実装済み）

## 参考資料

- `docs/steering/features/terminal.md` - 統合ターミナル機能仕様書（T-01〜T-13）
- `docs/steering/06_ubiquitous_language.md` - セクション 2.4（ターミナル用語）
- `src/components/TerminalPanel/TerminalPanel.tsx` - 実装済み単一ターミナルコンポーネント
- `src-tauri/src/commands/pty.rs` - 実装済み Rust PTY コマンド
