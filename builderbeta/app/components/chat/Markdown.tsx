import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';
import { Artifact } from './Artifact';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
}

export const Markdown = memo(({ children, html = false, limitedMarkdown = false }: MarkdownProps) => {
  logger.trace('Render');

  const components = useMemo(() => {
    return {
      div: ({ className, children, node, ...props }) => {
        if (className?.includes('__flareArtifact__')) {
          const messageId = node?.properties.dataMessageId as string;

          if (!messageId) {
            logger.error(`Invalid message id ${messageId}`);
          }

          return <Artifact messageId={messageId} />;
        }

        return (
          <div className={className} {...props}>
            {children}
          </div>
        );
      },
      pre: (props) => {
        const { children, node, ...rest } = props;

        const [firstChild] = node?.children ?? [];

        if (
          firstChild &&
          firstChild.type === 'element' &&
          firstChild.tagName === 'code' &&
          firstChild.children[0].type === 'text'
        ) {
          const { className, ...rest } = firstChild.properties;
          const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

          return <CodeBlock code={firstChild.children[0].value} language={language as BundledLanguage} {...rest} />;
        }

        return <pre {...rest}>{children}</pre>;
      },
      details: ({ className, children, ...props }) => (
        <details className="mt-4 mb-6 border border-white/10 rounded-xl overflow-hidden glass-effect group" {...props}>
          {children}
        </details>
      ),
      summary: ({ className, children, ...props }) => (
        <summary
          className="cursor-pointer bg-white/5 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center select-none"
          {...props}
        >
          <div className="i-ph:brain-duotone mr-2 text-lg text-white/50 group-hover:text-white/80 transition-colors" />
          {children}
        </summary>
      ),
      strong: ({ children, ...props }) => {
        const content = String(children);
        const agentColors: Record<string, string> = {
          '[Zeus]': 'text-yellow-400',
          '[Orion]': 'text-blue-400',
          '[Atlas]': 'text-green-400',
          '[Pixel]': 'text-pink-400',
          '[Dojo]': 'text-orange-400',
          '[Nitro]': 'text-purple-400',
          '[Scribe]': 'text-teal-400',
          '[Radar]': 'text-red-400',
        };

        const agentClass = agentColors[content] || '';

        return (
          <strong className={`${agentClass} font-bold`} {...props}>
            {children}
          </strong>
        );
      },
    } satisfies Components;
  }, []);

  return (
    <ReactMarkdown
      allowedElements={allowedHTMLElements}
      className={styles.MarkdownContent}
      components={components}
      remarkPlugins={remarkPlugins(limitedMarkdown)}
      rehypePlugins={rehypePlugins(html)}
    >
      {children}
    </ReactMarkdown>
  );
});
