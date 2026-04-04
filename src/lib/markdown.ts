import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'

// シングルトンでプロセッサーを構築（初回呼び出し時に非同期初期化）
let processorPromise: Promise<ReturnType<typeof unified>> | null = null
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
          // Mermaid は Shiki でハイライトせず、そのままの language-mermaid クラスを維持する
          langs: [],
        })
        .use(rehypeStringify, { allowDangerousHtml: true })
    })()
  }
  return processorPromise
}

export async function renderMarkdown(content: string, shikiTheme = 'github-dark'): Promise<string> {
  const processor = await getProcessor(shikiTheme)
  const result = await processor.process(content)
  return String(result)
}
