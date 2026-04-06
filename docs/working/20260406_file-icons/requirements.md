# 要件定義書 - Phase 3-D: 拡張子別ファイルアイコン

**フェーズ**: 3-D
**作成日**: 2026年4月6日
**ステータス**: 作成中

---

## 1. 背景・目的

現在のツリーパネルでは、ファイルアイコンを Lucide React の汎用アイコン（`FileText` / `File`）のみで表示しており、拡張子による視覚的な区別がほとんどない。VSCode ライクなアイコンを拡張子に応じて表示することで、ファイルの種類を一目で認識できるようにする。

---

## 2. 機能要件

### 2.1 拡張子別アイコン表示（3-D-1）

| 要件ID | 内容 | 優先度 |
|--------|------|--------|
| FR-01 | `@iconify/react` + `vscode-icons` セットを導入する | 必須 |
| FR-02 | `TreeNode` のファイルアイコンを拡張子に応じた VSCode 風アイコンに変更する | 必須 |
| FR-03 | フォルダアイコンも展開状態に応じて VSCode 風に変更する | 必須 |
| FR-04 | 対応していない拡張子はデフォルトファイルアイコンを表示する | 必須 |
| FR-05 | ローダー表示（ディレクトリ読み込み中）は変更しない | 必須 |

### 2.2 対応する拡張子・アイコン

最低限対応する拡張子：

| カテゴリ | 拡張子 | アイコン（vscode-icons ID） |
|---------|--------|--------------------------|
| Markdown | `.md`, `.mdx` | `vscode-icons:file-type-markdown` |
| TypeScript | `.ts` | `vscode-icons:file-type-typescript` |
| TypeScript JSX | `.tsx` | `vscode-icons:file-type-reactts` |
| JavaScript | `.js` | `vscode-icons:file-type-js` |
| JavaScript JSX | `.jsx` | `vscode-icons:file-type-reactjs` |
| Rust | `.rs` | `vscode-icons:file-type-rust` |
| Python | `.py` | `vscode-icons:file-type-python` |
| Go | `.go` | `vscode-icons:file-type-go` |
| JSON | `.json` | `vscode-icons:file-type-json` |
| TOML | `.toml` | `vscode-icons:file-type-toml` |
| YAML | `.yaml`, `.yml` | `vscode-icons:file-type-yaml` |
| CSS | `.css` | `vscode-icons:file-type-css` |
| HTML | `.html` | `vscode-icons:file-type-html` |
| SQL | `.sql` | `vscode-icons:file-type-sql` |
| Plain text | `.txt` | `vscode-icons:file-type-text` |
| フォルダ（閉） | — | `vscode-icons:default-folder` |
| フォルダ（開） | — | `vscode-icons:default-folder-opened` |
| デフォルト | その他 | `vscode-icons:default-file` |

---

## 3. 非機能要件

| 要件ID | 内容 |
|--------|------|
| NFR-01 | アイコン追加によるバンドルサイズ増加を最小限にとどめる（オンデマンドロードを活用） |
| NFR-02 | アイコンの表示サイズは現在の 14px を維持する |
| NFR-03 | ダーク・ライト両テーマで視認性を確保する |

---

## 4. スコープ外

- `@iconify/react` の全アイコンセット導入（`vscode-icons` のみ）
- ユーザーによるアイコンカスタマイズ
- アニメーション付きアイコン
- ファイル内容に基づくアイコン変更（拡張子のみで判定）
