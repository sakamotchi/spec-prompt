import * as Dialog from '@radix-ui/react-dialog'
import * as Slider from '@radix-ui/react-slider'
import { X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore, type Theme, type Language } from '../../stores/settingsStore'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { t } = useTranslation()
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const setContentFontFamily = useSettingsStore((s) => s.setContentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)
  const setContentFontSize = useSettingsStore((s) => s.setContentFontSize)
  const terminalFontFamily = useSettingsStore((s) => s.terminalFontFamily)
  const setTerminalFontFamily = useSettingsStore((s) => s.setTerminalFontFamily)
  const terminalFontSize = useSettingsStore((s) => s.terminalFontSize)
  const setTerminalFontSize = useSettingsStore((s) => s.setTerminalFontSize)

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'system', label: t('settings.theme.system') },
  ]
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'ja', label: t('settings.language.ja') },
    { value: 'en', label: t('settings.language.en') },
  ]
  const terminalFontOptions = [
    'Geist Mono',
    'Menlo',
    'Courier New',
    'HackGen35 Console NF',
    'HackGen Console NF',
    'Intel One Mono',
  ]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[360px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl focus:outline-none"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <Dialog.Title className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t('settings.title')}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-[var(--color-bg-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <X size={14} />
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 flex flex-col gap-5">
            {/* テーマセクション */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                {t('settings.section.theme')}
              </h3>
              <div className="flex gap-2">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                      theme === opt.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* コンテンツセクション */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                {t('settings.section.content')}
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{t('settings.label.font')}</span>
                  <FontInput
                    value={contentFontFamily}
                    placeholder="Geist, Inter, system-ui ..."
                    onChange={setContentFontFamily}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{t('settings.label.size')}</span>
                  <SizeSlider
                    value={contentFontSize}
                    min={12}
                    max={20}
                    onChange={setContentFontSize}
                  />
                </div>
              </div>
            </section>

            {/* ターミナルセクション */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                {t('settings.section.terminal')}
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{t('settings.label.font')}</span>
                  <FontCommitInput
                    value={terminalFontFamily}
                    suggestions={terminalFontOptions}
                    fallbackValue="Geist Mono"
                    onChange={setTerminalFontFamily}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{t('settings.label.size')}</span>
                  <SizeSlider
                    value={terminalFontSize}
                    min={11}
                    max={18}
                    onChange={setTerminalFontSize}
                  />
                </div>
              </div>
            </section>

            {/* 言語セクション */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                {t('settings.section.language')}
              </h3>
              <div className="flex gap-2">
                {languageOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLanguage(opt.value)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                      language === opt.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FontCommitInput({
  value,
  suggestions,
  fallbackValue,
  onChange,
}: {
  value: string
  suggestions: string[]
  fallbackValue: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => { setLocalValue(value) }, [value])

  const normalizedCurrent = value.trim()
  const normalizedInput = localValue.trim()
  const canApply = (normalizedInput || fallbackValue) !== normalizedCurrent

  const apply = () => {
    onChange(normalizedInput || fallbackValue)
  }

  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="text"
        value={localValue}
        list="terminal-font-suggestions"
        placeholder={fallbackValue}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
        className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
      />
      <datalist id="terminal-font-suggestions">
        {suggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={apply}
        disabled={!canApply}
        className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-bg-panel)] hover:border-[var(--color-text-muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {t('settings.button.apply')}
      </button>
    </div>
  )
}

function FontInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  // ストアの値が外部から変わったときに追従する
  useEffect(() => { setLocalValue(value) }, [value])

  const commit = () => {
    const v = localValue.trim()
    onChange(v || placeholder.split(',')[0].trim())
  }

  return (
    <input
      type="text"
      value={localValue}
      placeholder={placeholder}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="flex-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
    />
  )
}

function SizeSlider({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <Slider.Root
        className="relative flex items-center flex-1 h-4"
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      >
        <Slider.Track className="relative h-1 flex-1 rounded-full bg-[var(--color-border)]">
          <Slider.Range className="absolute h-full rounded-full bg-[var(--color-accent)]" />
        </Slider.Track>
        <Slider.Thumb className="block w-3.5 h-3.5 rounded-full bg-[var(--color-accent)] shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50" />
      </Slider.Root>
      <span className="text-xs text-[var(--color-text-muted)] w-10 text-right shrink-0">
        {value}px
      </span>
    </div>
  )
}
