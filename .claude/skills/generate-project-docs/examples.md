# 使用例

## 例1: macOS ウィンドウタブ統合の仕様ドキュメント作成

### ユーザー入力

```
macOSのネイティブウィンドウタブ統合機能を追加したい。プロジェクトドキュメントを作って。
```

### スキル実行の流れ

#### 1. 要件ヒアリング

```
- 要件名: macOSウィンドウタブ統合
- 目的: 複数プロジェクトを同時に扱うときの切り替えコスト削減
- スコープ: macOSのみ。Windows/Linuxは対象外。
```

#### 2. 既存コードベースの調査

Explore エージェントに依頼：

> macOSウィンドウタブ統合に関連する既存実装を調査。Tauri のウィンドウ生成箇所、既存のタブ管理（contentStore, terminalStore）、macOS 固有コードを洗い出す。

調査結果（例）：

- **再利用可**: `src-tauri/tauri.conf.json` のウィンドウ設定、`src/stores/appStore.ts` のプロジェクト管理
- **改修対象**: ウィンドウ生成処理（`src-tauri/src/main.rs`）への `tabbingIdentifier` 追加
- **新規**: Window メニューの ⌘T / ⌘` ハンドリング

#### 3. 認識合わせ

上記調査結果をユーザーに提示し、認識齟齬がなければ承認を得る。

#### 4. ディレクトリ作成 & ドキュメント生成

```bash
mkdir -p docs/projects/20260418-macOSウィンドウタブ統合
```

- `01_要件定義書.md` — 機能要件（FR-01〜）、対象OS、既存コードベースとの関係
- `02_概要設計書.md` — アーキテクチャ、`tabbingIdentifier` の設定方法、既存タブとの役割分担
- `03_WBS.md` — Phase 1: Tauri設定、Phase 2: メニュー統合、Phase 3: 動作確認

#### 5. 機密情報チェック

生成ファイルを grep → 検出なし → OK

#### 6. 完了報告

```
docs/projects/20260418-macOSウィンドウタブ統合/
├── 01_要件定義書.md
├── 02_概要設計書.md
└── 03_WBS.md

機密情報チェック: クリア
コミットしてよろしいですか？
```

---

## 例2: 機密情報が検出された場合

ユーザーから「社内のGitLabサーバー `gitlab.corp.example.com` と連携する機能を追加したい」という要件が来た場合：

#### 機密情報チェック時

```
⚠️ 機密情報候補を検出しました

- 01_要件定義書.md 行32: `gitlab.corp.example.com`
  → 社内ホスト名の可能性

対応案:
  (a) 「社内GitLabサーバー」のように汎用表現に置換
  (b) 該当セクションを削除
  (c) このまま残す（非推奨、docs/projectsはgit管理対象）

どうしますか？
```

---

## generate-working-docs との使い分け

| ケース | 使うスキル |
|---|---|
| 大規模機能（数日〜数週間）の全体仕様を起こす | `generate-project-docs` |
| WBS の 1 タスク単位の作業メモ・テスト手順 | `generate-working-docs` |
| 既存コードとの整合性確認が重要 | `generate-project-docs`（Explore調査が組み込まれている） |

典型的な流れ：

1. `generate-project-docs` で `docs/projects/20260501-xxx/` に要件・設計・WBS を作成
2. WBS の個別タスクに着手するタイミングで `generate-working-docs` を呼び、`docs/working/20260501_task-name/` に作業ドキュメントを作成
