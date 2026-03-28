# 要件定義書 - Phase 1-B: ファイルツリー（TreePanel）

## 概要

左ペインにプロジェクトのファイルツリーを表示する `TreePanel` コンポーネントを実装する。フォルダ選択ダイアログでプロジェクトを開き、ファイル・フォルダを階層表示する。ファイルをクリックすると `appStore` の `selectedFile` が更新され、コンテンツビューア（Phase 2-A）への接続準備が整う。

## 背景・目的

Phase 1-A で完成した左ペインのプレースホルダーを実際のファイルツリーに置き換える。Phase 1-B が完成することで Phase 2-A（コンテンツビューア）・Phase 2-D（パス入力支援）の実装が可能になる。

## 要件一覧

### 機能要件

#### F-1: ファイルツリー表示

- **説明**: プロジェクトルート配下のファイル・フォルダを階層表示する（`read_dir` Tauri コマンドは実装済み）
- **受け入れ条件**:
  - [ ] ディレクトリとファイルが階層インデント付きで表示される
  - [ ] ディレクトリを先に表示し、その後ファイルをアルファベット順で表示する（実装済み）
  - [ ] すべてのファイル・フォルダが表示される（除外なし）
  - [ ] ファイルとディレクトリを異なる Lucide アイコンで視覚的に区別する

#### F-2: 展開/折りたたみ

- **説明**: ディレクトリをクリックで展開・折りたたみを切り替える
- **受け入れ条件**:
  - [ ] ディレクトリをクリックすると展開/折りたたみが切り替わる
  - [ ] 展開状態は `appStore.expandedDirs: Set<string>` で管理される
  - [ ] 展開/折りたたみを示す矢印アイコン（ChevronRight / ChevronDown）が表示される
  - [ ] 初期表示では第1階層のディレクトリはすべて折りたたまれている

#### F-3: ファイル選択

- **説明**: ファイルをクリックすると `selectedFile` が更新される
- **受け入れ条件**:
  - [ ] ファイルをクリックすると `appStore.selectedFile` にパスが設定される
  - [ ] 選択中のファイルが `--color-bg-elevated` + `--color-accent` 左ボーダーでハイライトされる
  - [ ] ディレクトリをクリックしても `selectedFile` は変わらない（展開/折りたたみのみ）

#### F-4: プロジェクトを開くダイアログ

- **説明**: フォルダ選択ダイアログでプロジェクトルートを設定する
- **受け入れ条件**:
  - [ ] ツリーパネル上部の「プロジェクトを開く」ボタンをクリックするとフォルダ選択ダイアログが表示される
  - [ ] フォルダ選択後に `appStore.projectRoot` が更新され、ツリーが再取得・表示される
  - [ ] キャンセルした場合は何も変わらない

### 非機能要件

- **パフォーマンス**: ツリーノードのレンダリングは再帰コンポーネントで実装し、必要以上の再レンダリングが起きないよう `memo` を活用する
- **ユーザビリティ**: ローディング中はスピナーを表示し、エラー時はエラーメッセージを表示する
- **外観・デザイン**: Lucide アイコン + カラーパレット CSS カスタムプロパティを使用し、Phase 1-A のデザイン基盤と統一する

## スコープ

### 対象

- `src-tauri/src/commands/filesystem.rs` の除外リスト補完（`dist` 追加）
- `src/stores/appStore.ts` への `projectRoot` / `fileTree` / `selectedFile` / `expandedDirs` 追加
- `src/hooks/useFileTree.ts` の新規実装
- `src/components/TreePanel/` の新規実装
- `src/lib/tauriApi.ts` への `openDialog` 追加

### 対象外

- ファイル新規作成・削除・リネーム（Phase 2-E）
- Ctrl+クリックによるパス挿入（Phase 2-D）
- 右クリックコンテキストメニュー（Phase 2-D / 2-E）
- ファイル監視による自動更新（Phase 2-B）
- 仮想スクロール（Phase 3-D）

## 実装対象ファイル（予定）

- `src-tauri/src/commands/filesystem.rs`（除外リスト補完）
- `src/stores/appStore.ts`（状態追加）
- `src/hooks/useFileTree.ts`（新規）
- `src/components/TreePanel/TreePanel.tsx`（新規）
- `src/components/TreePanel/TreeNode.tsx`（新規）
- `src/components/TreePanel/index.ts`（新規）
- `src/components/Layout/AppLayout.tsx`（TreePanel を組み込み）
- `src/lib/tauriApi.ts`（`openDialog` 追加）

## 依存関係

- Phase 1-A が完了していること（左ペインのプレースホルダーが存在する）
- `read_dir` / `read_file` Rust コマンドは Phase 0-E で実装済み → バックエンド実装は最小限
- `tauri-plugin-dialog` は `src-tauri/Cargo.toml` に記載済みだが、`lib.rs` への登録確認が必要

## 既知の制約

- `tauri-plugin-dialog` の `open()` は非同期で結果を返す。TypeScript 側では `@tauri-apps/plugin-dialog` を npm install して使う
- フォルダ選択ダイアログは macOS のネイティブダイアログを使用するため `npx tauri dev` 環境でのみ動作確認可能

## 参考資料

- `docs/steering/features/file-tree.md` - 機能仕様詳細（FT-01〜FT-10）
- `docs/steering/06_ubiquitous_language.md` - セクション 2.2（ファイルツリー用語）
- `src-tauri/src/commands/filesystem.rs` - 実装済み Rust コマンド
