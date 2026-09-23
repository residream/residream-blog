import { parseFragment } from 'parse5'

type HtmlNode = {
  tagName?: string
  nodeName?: string
  value?: string
  attrs?: { name: string; value: string }[]
  childNodes?: HtmlNode[]
  sourceCodeLocation?: { startOffset: number; endOffset: number } | null
}

type Part = { type: 'html'; html: string } | { type: 'repo'; repo: string }

export function splitGithubCards(html: string): Part[] {
  const cards: { start: number; end: number; repo: string }[] = []

  function visit(node: HtmlNode, parent?: HtmlNode) {
    if (node.tagName === 'pre' || node.tagName === 'code') return
    if (node.tagName === 'github-card') {
      const repo = node.attrs?.find((attr) => attr.name === 'data-repo')?.value
      if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return
      const wrapped = parent?.tagName === 'p'
      if (
        wrapped &&
        parent.childNodes?.some(
          (child) => child !== node && !(child.nodeName === '#text' && !child.value?.trim())
        )
      )
        return

      const location = (wrapped ? parent : node)?.sourceCodeLocation
      if (location) cards.push({ start: location.startOffset, end: location.endOffset, repo })
      return
    }
    node.childNodes?.forEach((child) => visit(child, node))
  }

  visit(parseFragment(html, { sourceCodeLocationInfo: true }))
  const parts: Part[] = []
  let cursor = 0
  for (const card of cards) {
    parts.push({ type: 'html', html: html.slice(cursor, card.start) })
    parts.push({ type: 'repo', repo: card.repo })
    cursor = card.end
  }
  parts.push({ type: 'html', html: html.slice(cursor) })
  return parts
}
