"use client";

import type { ChatMessage, StreamPhase } from "@/hooks/useChat";
import { normalizeMarkdownContent } from "@/lib/markdown-formatting";
import "highlight.js/styles/github-dark.css";
import { memo, useMemo, type ComponentType, type HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const proseClasses = `chat-prose prose prose-invert prose-sm max-w-none
  prose-headings:font-display prose-headings:text-foreground
  prose-h2:text-base prose-h2:font-semibold prose-h2:mt-4 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/40
  prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1.5
  prose-h4:text-sm prose-h4:font-medium prose-h4:mt-2.5 prose-h4:mb-1.5
  prose-p:text-foreground/85 prose-p:my-1.5 prose-p:leading-[1.6]
  prose-a:text-coach prose-a:no-underline hover:prose-a:underline
  prose-li:text-foreground/85 prose-li:my-1 prose-li:leading-[1.6]
  prose-strong:text-foreground prose-strong:font-semibold
  prose-ol:my-2 prose-ul:my-2
  prose-hr:border-border/40 prose-hr:my-3 prose-hr:mx-[-0.125rem]
  prose-blockquote:border-coach/40 prose-blockquote:bg-coach/5 prose-blockquote:rounded-r-lg prose-blockquote:py-0.5 prose-blockquote:px-3 prose-blockquote:not-italic
  [&_table]:w-full [&_table]:my-3 [&_table]:text-sm [&_table]:border-collapse
  [&_thead]:border-b [&_thead]:border-border/50
  [&_th]:text-left [&_th]:text-foreground/70 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:font-medium [&_th]:py-2 [&_th]:px-3 [&_th]:bg-elevated/40
  [&_td]:py-1.5 [&_td]:px-3 [&_td]:text-foreground/80 [&_td]:border-b [&_td]:border-border/20
  [&_tbody_tr:last-child_td]:border-0
  [&_tbody_tr:hover]:bg-elevated/30
  [&_pre]:my-3
  [&_pre_code]:leading-[1.55]
  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`;

type CodeBlockProps = HTMLAttributes<HTMLElement> & {
  node?: unknown;
};

function CodeBlock({
  className,
  children,
  node: _node,
  ...props
}: CodeBlockProps) {
  void _node;
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : null;

  const contentStr = String(children || "");
  const isInline = !className && !contentStr.includes("\n");

  if (isInline) {
    return (
      <code
        className="text-coach bg-elevated/80 px-1.5 py-0.5 rounded text-[13px] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative my-2.5 w-full rounded-lg overflow-hidden border border-border/60 bg-elevated">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-elevated/50 border-b border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-dim font-mono">
            {lang}
          </span>
        </div>
      )}
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent overflow-x-auto">
        <code
          className={`${className || ""} font-mono !bg-transparent text-[13px] leading-relaxed block p-4`}
          {...props}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}

const ChatBubble = memo(function ChatBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const normalizedContent = useMemo(
    () => normalizeMarkdownContent(message.content),
    [message.content],
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/22 via-primary/14 to-primary/8 p-3 text-sm max-w-[85%] whitespace-pre-wrap text-foreground/95 shadow-[0_8px_22px_rgb(99_102_241_/_0.2)] backdrop-blur">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-coach/22 bg-surface/95 p-3.5 md:p-4 text-sm max-w-[92%] shadow-[0_8px_20px_rgb(14_165_233_/_0.08)] backdrop-blur overflow-x-auto">
        {isStreaming ? (
          <div className="whitespace-pre-wrap text-foreground/85 leading-relaxed">
            {normalizedContent}
          </div>
        ) : (
          <div className={proseClasses}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: CodeBlock as ComponentType<HTMLAttributes<HTMLElement>>,
                pre: ({ children }) => <>{children}</>,
                ul: ({ children }) => (
                  <ul className="my-2 list-disc space-y-1 pl-5 marker:text-coach/80">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-coach/80">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="pl-0.5 text-foreground/90">
                    {children}
                  </li>
                ),
                hr: () => (
                  <hr className="my-3 border-0 border-t border-dashed border-border/55" />
                ),
              }}
            >
              {normalizedContent}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-coach animate-pulse-cursor ml-0.5 mt-1" />
        )}
      </div>
    </div>
  );
});

type ConversationListProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamPhase: StreamPhase;
  showThinkingIndicator: boolean;
  modeStarters: string[];
  onStarterClick: (starter: string) => void;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
};

export function ConversationList({
  messages,
  isStreaming,
  streamPhase,
  showThinkingIndicator,
  modeStarters,
  onStarterClick,
  hasOlderMessages,
  isLoadingOlder,
  onLoadOlder,
}: ConversationListProps) {
  return (
    <div className="space-y-4">
      {hasOlderMessages && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={isLoadingOlder}
            onClick={onLoadOlder}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-60"
          >
            {isLoadingOlder
              ? "Loading older messages..."
              : "Load older messages"}
          </button>
        </div>
      )}

      {messages.map((message, index) => (
        <ChatBubble
          key={
            message.id ?? `${message.role}-${index}-${message.createdAt ?? ""}`
          }
          message={message}
          isStreaming={
            isStreaming &&
            index === messages.length - 1 &&
            message.role === "assistant"
          }
        />
      ))}

      {showThinkingIndicator && (
        <div className="flex justify-start">
          <div className="bg-surface border border-coach/15 rounded-xl px-4 py-3 text-xs text-muted-foreground inline-flex items-center gap-2">
            <span>
              {streamPhase === "thinking"
                ? "Sifu is thinking"
                : "Sifu is typing"}
            </span>
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-coach/70 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-coach/70 animate-pulse [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-coach/70 animate-pulse [animation-delay:240ms]" />
            </span>
          </div>
        </div>
      )}

      {!isStreaming &&
        messages.length === 1 &&
        messages[0].role === "assistant" && (
          <div className="flex flex-wrap gap-2 mt-2 px-1">
            {modeStarters.map((starter) => (
              <button
                type="button"
                key={starter}
                onClick={() => onStarterClick(starter)}
                className="text-xs px-3 py-1.5 rounded-full border border-coach/30 text-coach/80 hover:bg-coach/10 hover:border-coach/60 transition-colors cursor-pointer"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
