import { ChevronRight, Info } from 'lucide-react'
import type { Components } from 'react-markdown'

type DashboardMarkdownVariant = 'memory' | 'plan'

type DashboardMarkdownOptions = {
  variant: DashboardMarkdownVariant
  accentClassName: string
}

const VARIANT_STYLES: Record<DashboardMarkdownVariant, { link: string; inlineCode: string }> = {
  memory: {
    link: 'text-coach',
    inlineCode: 'text-coach bg-elevated/90',
  },
  plan: {
    link: 'text-plan',
    inlineCode: 'text-plan bg-elevated/90',
  },
}

export function createDashboardMarkdownComponents({
  variant,
  accentClassName,
}: DashboardMarkdownOptions): Components {
  const styles = VARIANT_STYLES[variant]
  const isPlan = variant === 'plan'

  return {
    h1: ({ children }) => (
      <div className="mb-4">
        <h1 className="text-xl font-display font-bold text-foreground">{children}</h1>
      </div>
    ),
    h2: ({ children }) => (
      <div className={`mt-8 mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${accentClassName}`}>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <h2 className="text-sm font-display font-semibold tracking-wide text-foreground">{children}</h2>
      </div>
    ),
    h3: ({ children }) => (
      <h3 className="mt-5 mb-2 ml-1 text-xs font-display font-semibold uppercase tracking-wider text-foreground/70">
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <div className="my-3 flex items-start gap-2.5 rounded-lg border border-coach/25 bg-coach/8 px-3.5 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coach" />
        <div className="text-[14px] leading-6 text-foreground/75 [&_p]:my-0 sm:text-[13px] sm:leading-6">{children}</div>
      </div>
    ),
    p: ({ children }) => (
      <p className="my-1.5 text-[15px] leading-7 text-foreground/85 sm:text-[14px] sm:leading-6">{children}</p>
    ),
    ul: ({ children }) => <ul className="my-2 ml-1 space-y-1.5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 ml-1 list-inside list-decimal space-y-1.5">{children}</ol>,
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-[15px] leading-7 text-foreground/85 sm:text-[14px] sm:leading-6">
        <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35 sm:mt-[8px]" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    a: ({ children, href }) => {
      const externalProps = isPlan ? { target: '_blank', rel: 'noopener noreferrer' } : {}
      return (
        <a href={href} {...externalProps} className={`${styles.link} underline-offset-2 hover:underline`}>
          {children}
        </a>
      )
    },
    code: ({ children, className }) => {
      if (className) {
        return <code className={`font-mono text-[13px] sm:text-xs ${className}`}>{children}</code>
      }

      return <code className={`${styles.inlineCode} rounded px-1.5 py-0.5 font-mono text-[13px]`}>{children}</code>
    },
    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto rounded-lg border border-border/50 bg-elevated/50 p-3 text-[13px] leading-6">
        {children}
      </pre>
    ),
    hr: () => <div className="my-4" />,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
        <table className="min-w-[30rem] w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-elevated/60">{children}</thead>,
    th: ({ children }) => (
      <th className="whitespace-nowrap border-b border-border/50 px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-foreground/75">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border/20 px-3 py-2 text-[14px] text-foreground/80 sm:text-[13px]">{children}</td>
    ),
    tr: ({ children }) => <tr className="transition-colors hover:bg-elevated/20">{children}</tr>,
  }
}
