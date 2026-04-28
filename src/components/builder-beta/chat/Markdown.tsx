"use client";

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { BundledLanguage } from "shiki";
import {
  rehypePlugins,
  remarkPlugins,
  allowedHTMLElements,
} from "@/lib/builder-beta/utils/markdown";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
}

export const Markdown = memo(
  ({ children, html = false, limitedMarkdown = false }: MarkdownProps) => {
    const components = useMemo(() => {
      return {
        div: ({ className, children, node, ...props }: any) => {
          if (className?.includes("__flareArtifact__")) {
            const messageId = node?.properties?.dataMessageId as string;
            return (
              <div className="my-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
                <span className="font-semibold">🔧 Artifact:</span>{" "}
                {messageId || "processing..."}
              </div>
            );
          }

          return (
            <div className={className} {...props}>
              {children}
            </div>
          );
        },
        pre: (props: any) => {
          const { children, node, ...rest } = props;
          const [firstChild] = node?.children ?? [];

          if (
            firstChild &&
            firstChild.type === "element" &&
            firstChild.tagName === "code" &&
            firstChild.children[0]?.type === "text"
          ) {
            const { className } = firstChild.properties || {};
            const [, language = "plaintext"] =
              /language-(\w+)/.exec(String(className) || "") ?? [];

            return (
              <CodeBlock
                code={firstChild.children[0].value}
                language={language as BundledLanguage}
              />
            );
          }

          return <pre {...rest}>{children}</pre>;
        },
        details: ({ children, ...props }: any) => (
          <details
            className="mt-4 mb-6 border border-zinc-700/50 rounded-xl overflow-hidden bg-zinc-800/30 group"
            {...props}
          >
            {children}
          </details>
        ),
        summary: ({ children, ...props }: any) => (
          <summary
            className="cursor-pointer bg-zinc-800/50 px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-700/50 transition-colors flex items-center select-none"
            {...props}
          >
            <span className="mr-2">🧠</span>
            {children}
          </summary>
        ),
        strong: ({ children, ...props }: any) => {
          const content = String(children);
          const agentColors: Record<string, string> = {
            "[Zeus]": "text-yellow-400",
            "[Orion]": "text-blue-400",
            "[Atlas]": "text-green-400",
            "[Pixel]": "text-pink-400",
            "[Dojo]": "text-orange-400",
            "[Nitro]": "text-purple-400",
            "[Scribe]": "text-teal-400",
            "[Radar]": "text-red-400",
          };

          const agentClass = agentColors[content] || "";

          return (
            <strong className={`${agentClass} font-bold`} {...props}>
              {children}
            </strong>
          );
        },
      } satisfies Components;
    }, []);

    return (
      <div className="prose prose-invert prose-sm max-w-none [&_p]:leading-relaxed [&_code]:text-violet-300 [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_a]:text-violet-400 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
        <ReactMarkdown
          allowedElements={allowedHTMLElements}
          components={components}
          remarkPlugins={remarkPlugins(limitedMarkdown)}
          rehypePlugins={rehypePlugins(html)}
        >
          {children}
        </ReactMarkdown>
      </div>
    );
  },
);

Markdown.displayName = "Markdown";
