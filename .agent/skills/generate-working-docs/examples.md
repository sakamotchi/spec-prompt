# 使用例

このドキュメントでは、開発作業ドキュメント生成スキルの使用例を記載します。

---

## 例1: 統合ターミナル機能の開発

### ユーザーの依頼

```
新規開発のドキュメント作ってください
```

### Claudeの応答

```
要件名を教えてください。
英語のケバブケース（例：terminal-tabs, file-tree）を推奨します。
```

### ユーザーの回答

```
terminal-tabs
```

### 生成結果

```
docs/working/20260328_terminal-tabs/
├── requirements.md   # 複数ターミナルタブの要件一覧
├── design.md         # xterm.js + PTY管理の設計
├── tasklist.md       # 実装タスク一覧
└── testing.md        # テスト手順
```

---

## 例2: マークダウンプレビュー機能の開発

### ユーザーの依頼

```
開発作業ドキュメント生成して。要件名はmarkdown-previewで。
```

### 生成結果

```
docs/working/20260328_markdown-preview/
├── requirements.md
├── design.md
├── tasklist.md
└── testing.md
```

---

## 例3: 要件名を日本語で指定した場合

### ユーザーの依頼

```
ドキュメント作って。パス検索パレット機能。
```

### Claudeの対応

要件名を英語のケバブケースに変換して確認：

```
「パス検索パレット機能」を英語のケバブケースに変換すると「path-palette」になりますが、
この名前でよろしいですか？
```

### 生成結果

```
docs/working/20260328_path-palette/
├── requirements.md
├── design.md
├── tasklist.md
└── testing.md
```

---

## ドキュメント完成後のワークフロー

### 1. feature ブランチを作成

```bash
git checkout -b feature/{WBS-ID}-{要件名}
# 例: feature/2-A-terminal-tabs
```

### 2. 各ファイルを編集

生成されたテンプレートをもとに、具体的な内容を記載します。

### 3. タスクを進行

`tasklist.md` のチェックボックスを更新しながら開発を進めます。

### 4. テストを実施

`testing.md` の手順に従ってテストを実施し、結果を記録します。

### 5. 開発完了後

1. **永続化ドキュメントを更新**（必要な場合）
   - `docs/steering/01_product_requirements.md` の機能ステータスを更新
   - `docs/steering/features/` の機能仕様を更新

2. **PRを作成して develop にマージ**
   - PR本文に `Closes #<issue番号>` を記載

3. **作業ドキュメントはそのまま残す**
   - `docs/working/` の内容はgit管理外（.gitignore推奨）またはそのまま保持
