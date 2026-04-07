# 設計書 - Phase 3-F: 多言語対応（日本語・英語）

**フェーズ**: 3-F
**作成日**: 2026年4月6日
**ステータス**: 作成中

---

## 1. 実装方針

### 1.1 ライブラリ選定

| ライブラリ | 役割 |
|-----------|------|
| `i18next` | i18n コア。翻訳リソース管理・補間・言語切り替え |
| `react-i18next` | React バインディング。`useTranslation` フック・`Trans` コンポーネント |

### 1.2 言語ファイル配置

```
src/
└── i18n/
    ├── index.ts          # i18next 初期化
    └── locales/
        ├── ja.json       # 日本語（デフォルト）
        └── en.json       # 英語
```

### 1.3 言語設定の永続化

`settingsStore` に `language: 'ja' | 'en'` フィールドを追加する。既存の `persist` middleware によりlocalStorageに保存される。アプリ起動時に `i18next.changeLanguage()` で反映する。

---

## 2. 実装詳細

### 2.1 パッケージインストール

```bash
npm install i18next react-i18next
```

### 2.2 i18next 初期化（`src/i18n/index.ts`）

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from './locales/ja.json'
import en from './locales/en.json'

i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: 'ja',
  fallbackLng: 'ja',
  interpolation: { escapeValue: false }, // React は XSS をエスケープ済み
})

export default i18n
```

### 2.3 アプリへの組み込み（`src/main.tsx`）

```tsx
import './i18n'  // i18next を副作用として初期化
```

### 2.4 settingsStore への追加

```ts
// src/stores/settingsStore.ts に追加
interface SettingsState {
  // ...既存フィールド...
  language: 'ja' | 'en'
  setLanguage: (lang: 'ja' | 'en') => void
}

// 初期値
language: 'ja',

// アクション（言語変更時に i18next にも反映）
setLanguage: (lang) => {
  set({ language: lang })
  i18n.changeLanguage(lang)
},
```

起動時の同期（`src/main.tsx` または `App.tsx`）：

```ts
const { language } = useSettingsStore.getState()
i18n.changeLanguage(language)
```

### 2.5 コンポーネントでの使用

```tsx
import { useTranslation } from 'react-i18next'

// Before
<span>フォルダを開いてください</span>

// After
const { t } = useTranslation()
<span>{t('tree.emptyState')}</span>
```

補間（動的値）：

```tsx
// Before
`選択中 ${count} 件をすべて挿入`

// After
t('contextMenu.insertAll', { count })
```

### 2.6 `shortcuts.ts` の翻訳対応

`ShortcutDef.label` と `ShortcutDef.category` は現在静的な文字列。`useTranslation` はフック（コンポーネント内のみ使用可）なので、`SHORTCUT_DEFS` は翻訳キーを保持し、表示時にコンポーネント側で `t()` を適用する。

```ts
// src/lib/shortcuts.ts — キーのみ保持（日本語文字列を削除）
export type ShortcutCategory =
  | 'shortcuts.category.pane'
  | 'shortcuts.category.tab'
  | 'shortcuts.category.split'
  | 'shortcuts.category.focus'
  | 'shortcuts.category.other'

export interface ShortcutDef {
  labelKey: string   // 翻訳キー
  keys: string[]
  category: ShortcutCategory
}
```

```tsx
// ShortcutsModal.tsx — 表示時に t() を適用
const { t } = useTranslation()
<span>{t(def.labelKey)}</span>
<h3>{t(group.category)}</h3>
```

### 2.7 言語切り替えUI（`SettingsModal.tsx`）

設定モーダルの既存セクション末尾に「言語」セクションを追加する：

```tsx
// 言語セレクター（ラジオボタン形式、テーマ選択と同じ実装パターン）
<section>
  <h3>{t('settings.section.language')}</h3>
  {(['ja', 'en'] as const).map((lang) => (
    <label key={lang}>
      <input
        type="radio"
        value={lang}
        checked={language === lang}
        onChange={() => setLanguage(lang)}
      />
      {t(`settings.language.${lang}`)}
    </label>
  ))}
</section>
```

---

## 3. 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `package.json` | 変更 | `i18next`, `react-i18next` を追加 |
| `src/i18n/index.ts` | 新規 | i18next 初期化 |
| `src/i18n/locales/ja.json` | 新規 | 日本語翻訳ファイル（77件） |
| `src/i18n/locales/en.json` | 新規 | 英語翻訳ファイル（77件） |
| `src/main.tsx` | 変更 | `./i18n` インポートと起動時言語同期 |
| `src/stores/settingsStore.ts` | 変更 | `language` フィールド・`setLanguage` アクションを追加 |
| `src/lib/shortcuts.ts` | 変更 | `label` を `labelKey`（翻訳キー）に変更、`ShortcutCategory` を翻訳キー型に変更 |
| `src/components/KeyboardShortcuts/ShortcutsModal.tsx` | 変更 | `useTranslation` で `labelKey` / `category` を翻訳 |
| `src/components/Settings/SettingsModal.tsx` | 変更 | 言語セクション追加、全文字列を `t()` に置き換え |
| `src/components/TreePanel/TreePanel.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TreePanel/TreeNode.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TreePanel/ContextMenu.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TreePanel/RecentProjectsMenu.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TreePanel/DeleteDialog.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/ContentView/ContentTabBar.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/MainArea/MainArea.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TerminalPanel/TerminalTabs.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/components/TerminalPanel/TerminalPanel.tsx` | 変更 | エラーメッセージを `i18n.t()` に置き換え |
| `src/components/PathPalette/PathPalette.tsx` | 変更 | 全文字列を `t()` に置き換え |
| `src/lib/frontmatter.ts` | 変更 | `DocStatus` 表示ラベルを翻訳キー化（または別途マッピング） |
| `README.md` | 変更 | 英語で整備 |
| `README.ja.md` | 新規 | 日本語で整備 |
