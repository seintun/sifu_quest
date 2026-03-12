type NormalizeMarkdownOptions = {
  collapseBlankLines?: boolean
}

export function normalizeMarkdownContent(
  content: string,
  options: NormalizeMarkdownOptions = {},
): string {
  const { collapseBlankLines = true } = options

  let normalized = content
    .replace(/\r\n?/g, '\n')
    // Fix malformed list prefixes from streamed chunks: "-item" => "- item".
    .replace(/^(\s*[-*])(\S)/gm, '$1 $2')
    // Normalize em/en-dash bullets to markdown bullets.
    .replace(/^\s*[–—]\s+/gm, '- ')
    // Normalize divider-like lines into markdown hr.
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '---')
    // Trim trailing spaces before newline.
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd()

  if (collapseBlankLines) {
    normalized = normalized.replace(/\n{3,}/g, '\n\n')
  }

  return normalized
}

