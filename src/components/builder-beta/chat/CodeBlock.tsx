"use client";

import { memo, useEffect, useState } from "react";
import {
  bundledLanguages,
  codeToHtml,
  isSpecialLang,
  type BundledLanguage,
  type SpecialLanguage,
} from "shiki";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: "light-plus" | "dark-plus";
  disableCopy?: boolean;
}

export const CodeBlock = memo(
  ({
    className,
    code,
    language = "plaintext",
    theme = "dark-plus",
    disableCopy = false,
  }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
      if (copied) return;
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
      if (
        language &&
        !isSpecialLang(language) &&
        !(language in bundledLanguages)
      ) {
        console.warn(`[CodeBlock] Unsupported language '${language}'`);
      }

      const processCode = async () => {
        setHTML(await codeToHtml(code, { lang: language, theme }));
      };

      processCode();
    }, [code, language, theme]);

    return (
      <div className={`relative group text-left ${className || ""}`}>
        {!disableCopy && (
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 hover:text-white text-xs transition-colors"
              title="Copy Code"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
        <div
          className="[&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:text-sm [&_pre]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html ?? "" }}
        />
      </div>
    );
  },
);

CodeBlock.displayName = "CodeBlock";
