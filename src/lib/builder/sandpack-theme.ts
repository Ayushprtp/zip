import { SandpackTheme } from "@codesandbox/sandpack-react";

export function createSandpackTheme(isDark: boolean): SandpackTheme {
  if (isDark) {
    return {
      colors: {
        surface1: "hsl(var(--background))",
        surface2: "hsl(var(--muted))",
        surface3: "hsl(var(--accent))",
        clickable: "hsl(var(--primary))",
        base: "hsl(var(--foreground))",
        disabled: "hsl(var(--muted-foreground))",
        hover: "hsl(var(--accent))",
        accent: "hsl(var(--primary))",
        error: "hsl(var(--destructive))",
        errorSurface: "hsl(var(--destructive) / 0.1)",
      },
      syntax: {
        plain: "hsl(var(--foreground))",
        comment: { color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
        keyword: "hsl(220 90% 70%)",
        tag: "hsl(330 80% 70%)",
        punctuation: "hsl(var(--foreground))",
        definition: "hsl(200 80% 70%)",
        property: "hsl(280 70% 75%)",
        static: "hsl(40 90% 70%)",
        string: "hsl(120 60% 70%)",
      },
      font: {
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: '"Fira Code", "Fira Mono", Menlo, Monaco, "Courier New", monospace',
        size: "13px",
        lineHeight: "1.6",
      },
    };
  }

  // Light theme
  return {
    colors: {
      surface1: "hsl(var(--background))",
      surface2: "hsl(var(--muted))",
      surface3: "hsl(var(--accent))",
      clickable: "hsl(var(--primary))",
      base: "hsl(var(--foreground))",
      disabled: "hsl(var(--muted-foreground))",
      hover: "hsl(var(--accent))",
      accent: "hsl(var(--primary))",
      error: "hsl(var(--destructive))",
      errorSurface: "hsl(var(--destructive) / 0.1)",
    },
    syntax: {
      plain: "hsl(var(--foreground))",
      comment: { color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
      keyword: "hsl(220 90% 40%)",
      tag: "hsl(330 80% 45%)",
      punctuation: "hsl(var(--foreground))",
      definition: "hsl(200 80% 40%)",
      property: "hsl(280 70% 45%)",
      static: "hsl(40 90% 40%)",
      string: "hsl(120 60% 35%)",
    },
    font: {
      body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"Fira Code", "Fira Mono", Menlo, Monaco, "Courier New", monospace',
      size: "13px",
      lineHeight: "1.6",
    },
  };
}
