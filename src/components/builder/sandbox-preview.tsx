"use client";

/* eslint-disable i18next/no-literal-string -- Super-admin-only AI Builder
   surface: this whole tool is gated to internal super_admin users and is
   intentionally English-only. Adding it to the i18n keyset would inflate the
   FR/AR translation backlog for a tool no end user ever sees. */
import { Loader2, RefreshCw, Code2, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SandboxPreviewProps {
  code: string | null;
  language: "typescript" | "python" | "javascript";
  isStreaming: boolean;
  className?: string;
}

export function SandboxPreview({ code, language, isStreaming, className }: SandboxPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<"preview" | "code">("code");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const extractedCode = extractCodeBlock(code ?? "");

  async function buildPreview() {
    if (!extractedCode || language !== "typescript") return;
    setIsBuilding(true);
    try {
      const html = buildReactPreviewHtml(extractedCode);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setView("preview");
    } catch (err) {
      console.error("Preview build failed:", err);
    } finally {
      setIsBuilding(false);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background border rounded-lg overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <Tabs value={view} onValueChange={(v) => setView(v as "preview" | "code")}>
          <TabsList className="h-7">
            <TabsTrigger value="code" className="text-xs h-6 px-2">
              <Code2 className="w-3 h-3 mr-1" />
              Code
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs h-6 px-2">
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          {language === "typescript" && extractedCode && !isStreaming && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              onClick={buildPreview}
              disabled={isBuilding}
            >
              {isBuilding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span className="ml-1">Build preview</span>
            </Button>
          )}
          {/*
            NOTE: an "open in new tab" button was intentionally removed. A blob URL
            opened via window.open inherits this app's origin and runs unsandboxed,
            which lets AI-generated code read cookies / call same-origin APIs as the
            super_admin. The iframe path below renders the same content inside a
            sandbox without `allow-same-origin`, giving it a unique opaque origin.
          */}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {view === "code" ? (
          <div className="h-full overflow-auto">
            {isStreaming && !extractedCode ? (
              <div className="flex items-center gap-2 p-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating code...
              </div>
            ) : (
              <pre className="p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
                <code>{extractedCode || code || ""}</code>
              </pre>
            )}
          </div>
        ) : (
          <div className="h-full">
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                // Intentionally no `allow-same-origin`: the iframe loads a blob:
                // URL containing AI-generated code. Without `allow-same-origin`
                // the iframe gets a unique opaque origin, so the generated code
                // cannot read this app's cookies, localStorage, or call our APIs
                // with the user's session.
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                title="Code preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Eye className="w-8 h-8 opacity-30" />
                <p className="text-sm">Click &quot;Build preview&quot; to render the component</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function extractCodeBlock(content: string): string {
  const match = content.match(/```(?:tsx?|jsx?|typescript|javascript)\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  const fallback = content.match(/```\n([\s\S]*?)```/);
  if (fallback) return fallback[1].trim();
  return "";
}

function buildReactPreviewHtml(componentCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${componentCode}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    try {
      const Component = typeof App !== 'undefined' ? App
        : typeof Page !== 'undefined' ? Page
        : typeof Dashboard !== 'undefined' ? Dashboard
        : () => React.createElement('div', null, 'Component rendered successfully');
      root.render(React.createElement(Component));
    } catch(e) {
      root.render(React.createElement('div', { style: { color: 'red', padding: 16 } }, 'Preview error: ' + e.message));
    }
  </script>
</body>
</html>`;
}
