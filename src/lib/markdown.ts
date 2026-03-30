import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'

// シングルトンでプロセッサーを構築（初回呼び出し時に非同期初期化）
let processorPromise: Promise<ReturnType<typeof unified>> | null = null

async function getProcessor() {
  if (!processorPromise) {
    processorPromise = (async () => {
      return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeShiki, {
          theme: 'github-dark',
          // Mermaid は Shiki でハイライトせず、そのままの language-mermaid クラスを維持する
          langs: [],
        })
        .use(rehypeStringify, { allowDangerousHtml: true })
    })()
  }
  return processorPromise
}

export async function renderMarkdown(content: string): Promise<string> {
  const processor = await getProcessor()
  const result = await processor.process(content)
  return String(result)
}
