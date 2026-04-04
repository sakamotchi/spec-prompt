# 設計書 - Phase 3-B: テーマ・外観設定

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    SettingsModal（新規）
    settingsStore（新規 Zustand）
    TreePanel（ギアアイコン追加）
    markdown.ts（Shiki テーマ動的化）
    TerminalPanel（xterm テーマ・フォント動的化）
    index.css（ライトテーマ変数追加）
         ↓ invoke()
Tauri IPC
         ↓
Rust Backend
    config.rs（AppearanceSettings 追加）
         ↓
~/.../spec-prompt/config.json
```

### 影響範囲

- **フロントエンド**: `settingsStore`, `SettingsModal`, `TreePanel`, `markdown.ts`, `TerminalPanel`, `index.css`, `main.tsx`
- **バックエンド（Rust）**: `config.rs`（構造体拡張）, `lib.rs`

---

## 実装方針

### 概要

設定は `settingsStore`（Zustand）でインメモリ管理し、`config.json` を永続化の単一ソースとする。起動時に `get_appearance` でロード、変更のたびに `save_appearance` で保存する。テーマ切り替えは `<html data-theme="...">` 属性を変更するだけで CSS カスタムプロパティが切り替わる。

### 詳細

1. **CSS テーマ切り替え**: `index.css` に `:root`（ダーク）と `[data-theme="light"]`（ライト）の2セットの CSS カスタムプロパティを定義。`document.documentElement.setAttribute('data-theme', resolved)` で即座に反映。
2. **system テーマ**: `window.matchMedia('(prefers-color-scheme: dark)').matches` で判定し、`change` イベントで追従。
3. **Shiki テーマ**: `processorPromise` のモジュール変数を `null` にリセットして再初期化。コンテンツタブを再読み込みするため `contentStore.reloadAllTabs()` を呼ぶ。
4. **xterm.js テーマ・フォント**: `terminal.options.theme` / `terminal.options.fontFamily` / `terminal.options.fontSize` を直接更新。xterm.js はオプション変更を即座に反映する。
5. **設定変更の即時反映**: `settingsStore` の変更を各コンポーネントが `useEffect` で監視して適用する。

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/settingsStore.ts
export type Theme = 'dark' | 'light' | 'system'

export interface AppearanceSettings {
  theme: Theme
  contentFontFamily: string
  contentFontSize: number        // 12〜20 (px)
  terminalFontFamily: string
  terminalFontSize: number       // 11〜18 (px)
}

export const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  contentFontFamily: 'Geist',
  contentFontSize: 16,
  terminalFontFamily: 'Geist Mono',
  terminalFontSize: 14,
}

interface SettingsState extends AppearanceSettings {
  setTheme: (theme: Theme) => void
  setContentFontFamily: (family: string) => void
  setContentFontSize: (size: number) => void
  setTerminalFontFamily: (family: string) => void
  setTerminalFontSize: (size: number) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}
```

### 型定義（Rust）

```rust
// config.rs に追加
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    pub theme: String,                // "dark" | "light" | "system"
    pub content_font_family: String,
    pub content_font_size: u8,
    pub terminal_font_family: String,
    pub terminal_font_size: u8,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            content_font_family: "Geist".to_string(),
            content_font_size: 16,
            terminal_font_family: "Geist Mono".to_string(),
            terminal_font_size: 14,
        }
    }
}

// Config 構造体に追加
pub struct Config {
    pub recent_projects: Vec<String>,
    pub appearance: AppearanceSettings,   // 追加
}
```

---

## API設計

### Tauriコマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `get_appearance` | なし | `Result<AppearanceSettings, String>` | 外観設定を取得 |
| `save_appearance` | `settings: AppearanceSettings` | `Result<(), String>` | 外観設定を保存 |

### Tauriイベント

なし（設定変更はフロントエンド主導で即時適用）

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dialog` | 設定モーダル | 新規インストール |
| `@radix-ui/react-slider` | フォントサイズスライダー | 新規インストール |
| `@radix-ui/react-select` | フォントファミリーセレクト | 新規インストール |
| `lucide-react` | `Settings` アイコン | 既存利用 |

### カラーパレット（ライトテーマ追加）

`index.css` に以下を追加：

```css
[data-theme="light"] {
  --color-bg-base:      #ffffff;
  --color-bg-panel:     #f5f5f5;
  --color-bg-elevated:  #ebebeb;
  --color-border:       #d4d4d4;
  --color-text-primary: #1a1a1a;
  --color-text-muted:   #666666;
  --color-accent:       #7c6af7;
}
```

### 画面構成

#### TreePanel ヘッダー（変更後）

```
┌─────────────────────────────────────┐
│ [▼ spec-prompt]    [📂] [⚙]         │  ← ギアアイコンを追加
└─────────────────────────────────────┘
```

#### 設定モーダル

```
┌─────────────────────────────────┐
│ 外観設定                    [✕] │
├─────────────────────────────────┤
│ テーマ                          │
│  [ダーク] [ライト] [システム]    │
├─────────────────────────────────┤
│ コンテンツ                      │
│  フォント  [Geist        ▼]     │
│  サイズ    [──●──────] 16px    │
├─────────────────────────────────┤
│ ターミナル                      │
│  フォント  [Geist Mono   ▼]     │
│  サイズ    [──●──────] 14px    │
└─────────────────────────────────┘
```

### コンポーネント構成

```
TreePanel
  └─ Settings ボタン（クリックで settingsOpen state を true に）

SettingsModal（新規）
  ├─ Dialog.Root（Radix UI）
  ├─ テーマセクション（3ボタントグル）
  ├─ コンテンツセクション
  │   ├─ Select（フォントファミリー）
  │   └─ Slider（フォントサイズ 12〜20px）
  └─ ターミナルセクション
      ├─ Select（フォントファミリー）
      └─ Slider（フォントサイズ 11〜18px）
```

---

## 状態管理

### settingsStore.ts（新規）

```typescript
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)           // <html data-theme="..."> を更新
    invalidateMarkdown()        // Shiki プロセッサーをリセット
    get().saveSettings()
  },
  setContentFontFamily: (family) => { set({ contentFontFamily: family }); get().saveSettings() },
  setContentFontSize: (size) => { set({ contentFontSize: size }); get().saveSettings() },
  setTerminalFontFamily: (family) => { set({ terminalFontFamily: family }); get().saveSettings() },
  setTerminalFontSize: (size) => { set({ terminalFontSize: size }); get().saveSettings() },

  loadSettings: async () => {
    const s = await tauriApi.getAppearance()
    set(s)
    applyTheme(s.theme)
  },
  saveSettings: async () => {
    const { theme, contentFontFamily, contentFontSize, terminalFontFamily, terminalFontSize } = get()
    await tauriApi.saveAppearance({ theme, contentFontFamily, contentFontSize, terminalFontFamily, terminalFontSize })
  },
}))

function applyTheme(theme: Theme) {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  document.documentElement.setAttribute('data-theme', resolved)
}
```

### markdown.ts の変更

```typescript
// プロセッサーを Shiki テーマが変化したときにリセットする
let processorPromise: Promise<...> | null = null
let builtTheme = ''

export function invalidateMarkdownProcessor() {
  processorPromise = null
}

export async function renderMarkdown(content: string, shikiTheme: string): Promise<string> {
  if (builtTheme !== shikiTheme) {
    processorPromise = null
    builtTheme = shikiTheme
  }
  // ...processor 構築...
}
```

### MarkdownPreview の変更

```typescript
// settingsStore から theme を参照して shikiTheme を決定
const theme = useSettingsStore(s => s.theme)
const resolvedTheme = theme === 'system'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : theme
const shikiTheme = resolvedTheme === 'dark' ? 'github-dark' : 'github-light'

useEffect(() => {
  renderMarkdown(content, shikiTheme).then(setHtml)
}, [content, shikiTheme])
```

### TerminalPanel の変更

```typescript
const terminalFontFamily = useSettingsStore(s => s.terminalFontFamily)
const terminalFontSize = useSettingsStore(s => s.terminalFontSize)
const theme = useSettingsStore(s => s.theme)

// フォント変更
useEffect(() => {
  if (!termRef.current) return
  termRef.current.options.fontFamily = `'${terminalFontFamily}', monospace`
  termRef.current.options.fontSize = terminalFontSize
  fitAddonRef.current?.fit()
}, [terminalFontFamily, terminalFontSize])

// テーマ変更
useEffect(() => {
  if (!termRef.current) return
  const isDark = resolvedTheme === 'dark'
  termRef.current.options.theme = {
    background: isDark ? '#0d0d0d' : '#ffffff',
    foreground: isDark ? '#e8e8e8' : '#1a1a1a',
    cursor: '#7c6af7',
    selectionBackground: '#7c6af740',
  }
}, [resolvedTheme])
```

---

## テストコード

### Rust テスト

```rust
#[test]
fn test_appearance_default() {
    let s = AppearanceSettings::default();
    assert_eq!(s.theme, "dark");
    assert_eq!(s.content_font_size, 16);
}

#[test]
fn test_config_with_appearance_roundtrip() {
    // Config を JSON シリアライズ → デシリアライズして appearance が保持されることを確認
}
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `settingsStore` を appStore から分離 | 外観設定は独立した関心事。appStore が肥大化するのを防ぐ | appStore に統合 |
| 変更即時保存（保存ボタンなし） | UX の簡素化。設定値が小さく頻繁に書き込んでも問題ない | 「保存」ボタンで一括保存 |
| `config.json` を真実の源とする | Phase 2-F と同じ方針。localStorage との二重管理を避ける | settingsStore を persist で localStorage に保存 |
| `appearance` を Config のサブ構造体にする | 将来のフィールド追加が Config に影響しない | Config にフラットに展開 |
| ターミナルフォントを Geist Mono / Menlo / Courier New に絞る | 外部フォント読み込み不要。システムフォントで確実に動作 | Fira Code 等を追加（将来対応） |

## 未解決事項

- [ ] `system` テーマ時、OS のテーマが変化したときの xterm.js への反映（`matchMedia` の `change` イベントリスナー）
- [ ] コンテンツフォントとして `Inter` を読み込む方法（現状は Geist と system-ui のみ確実に動作）
