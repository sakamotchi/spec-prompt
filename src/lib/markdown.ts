import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import { SHIKI_LANGS } from './shikiLangs'

// シングルトンでプロセッサーを構築（初回呼び出し時に非同期初期化）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processorPromise: Promise<any> | null = null
let builtTheme = ''

export function invalidateMarkdownProcessor() {
  processorPromise = null
}

async function getProcessor(shikiTheme: string) {
  if (!processorPromise || builtTheme !== shikiTheme) {
    builtTheme = shikiTheme
    processorPromise = (async () => {
      return unified()
        .use(remarkParse)
        .use(remarkFrontmatter)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeShiki, {
          theme: shikiTheme,
          langs: SHIKI_LANGS,
        })
        .use(rehypeStringify, { allowDangerousHtml: true })
    })()
  }
  return processorPromise!
}

export async function renderMarkdown(content: string, shikiTheme = 'github-dark'): Promise<string> {
  const processor = await getProcessor(shikiTheme)
  const result = await processor.process(content)
  return String(result)
}
