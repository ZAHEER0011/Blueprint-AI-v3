import React, { useEffect, useRef } from "react";
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
    useSandpack,
} from "@codesandbox/sandpack-react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

// Listens for Sandpack errors and dispatches a custom DOM event.
// The parent page captures this event and sets previewError state.
function SandpackErrorListener() {
    const { listen } = useSandpack();
    const lastErrorRef = useRef<string | null>(null);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unsubscribe = listen((payload: any) => {
            if (payload.type === "action" && payload.action === "show-error") {
                const errorMessage = [payload.title, payload.path, payload.message]
                    .filter(Boolean)
                    .join("\n");

                // Prevent duplicate error events
                if (lastErrorRef.current === errorMessage) return;
                lastErrorRef.current = errorMessage;

                window.dispatchEvent(
                    new CustomEvent("sandpack-error", {
                        detail: { error: errorMessage },
                    })
                );
            }
            if (payload.type === "done") {
                // Clear error ref on successful compile
                lastErrorRef.current = null;
            }
        });

        return unsubscribe;
    }, [listen]);

    return null;
}

function parseEnvContent(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    const lines = content.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();

        // Strip quotes if they match on both ends
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        env[key] = val;
    }
    return env;
}

export interface PreviewPanelProps {
    files: Record<string, string>;
    isStreaming?: boolean;
    /** The current preview error, if any */
    previewError?: string | null;
    /** Called when the user clicks the "Fix Error" button */
    onFixError?: (error: string) => void;
    tasks?: Array<{ description: string; status: "pending" | "in_progress" | "completed" }>;
}

export function PreviewPanel({ files, isStreaming, previewError, onFixError, tasks }: PreviewPanelProps) {
    // Convert paths from "src/App.tsx" to "/src/App.tsx" as expected by Sandpack
    const sandpackFiles = Object.entries(files).reduce((acc, [path, content]) => {
        const spPath = path.startsWith("/") ? path : `/${path}`;
        acc[spPath] = content;
        return acc;
    }, {} as Record<string, string>);

    // Parse env files (.env, .env.local, etc.)
    const envVars: Record<string, string> = {};
    const envFileKeys = [".env", ".env.local", "/.env", "/.env.local"];
    for (const key of envFileKeys) {
        if (files[key]) {
            const parsed = parseEnvContent(files[key]);
            Object.assign(envVars, parsed);
        }
    }

    const envScript = `<script>
      window.process = window.process || {};
      window.process.env = {
        ...window.process.env,
        ${Object.entries(envVars)
            .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
            .join(",\n        ")}
      };
    </script>`;

    const envScriptBlock = `\n    <!-- ENV_VARS_START -->\n    ${envScript}\n    <!-- ENV_VARS_END -->\n`;

    // Inject env vars and Tailwind CDN in public/index.html in-memory for preview compilation
    const indexHtmlPath = "/public/index.html";
    if (!sandpackFiles[indexHtmlPath]) {
        sandpackFiles[indexHtmlPath] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <!-- ENV_VARS_START -->
    ${envScript}
    <!-- ENV_VARS_END -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html, body, #root {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    } else {
        let content = sandpackFiles[indexHtmlPath];

        // Replace or insert the env script block
        if (content.includes("<!-- ENV_VARS_START -->") && content.includes("<!-- ENV_VARS_END -->")) {
            const startIndex = content.indexOf("<!-- ENV_VARS_START -->");
            const endIndex = content.indexOf("<!-- ENV_VARS_END -->") + "<!-- ENV_VARS_END -->".length;
            content = content.slice(0, startIndex) + envScriptBlock + content.slice(endIndex);
        } else {
            if (content.includes("</head>")) {
                content = content.replace("</head>", `${envScriptBlock}</head>`);
            } else {
                content = envScriptBlock + content;
            }
        }

        if (!content.includes("cdn.tailwindcss.com")) {
            const scriptStyleStr = `\n  <script src="https://cdn.tailwindcss.com"></script>\n  <style>html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }</style>\n`;
            if (content.includes("</head>")) {
                content = content.replace("</head>", `${scriptStyleStr}</head>`);
            } else {
                content = scriptStyleStr + content;
            }
        }
        sandpackFiles[indexHtmlPath] = content;
    }

    const hasFiles = Object.keys(sandpackFiles).length > 0;

    const packageJsonPath = files["package.json"] ? "package.json" : "/package.json";
    let packageDependencies: Record<string, string> = {};

    const rawPackageJson = files[packageJsonPath];
    if (rawPackageJson) {
        try {
            const trimmed = rawPackageJson.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                const parsed = JSON.parse(trimmed);
                packageDependencies = parsed?.dependencies || {};
            }
        } catch {
            // Silently ignore during initial extraction
        }
    }

    const baseDependencies: Record<string, string> = {
        "lucide-react": "latest",
        "date-fns": "latest",
        "recharts": "latest",
        "react-router-dom": "latest",
        "framer-motion": "latest",
        "clsx": "latest",
        "tailwind-merge": "latest",
        "class-variance-authority": "latest",
        "@radix-ui/react-slot": "latest",
    };

    // Final safety check for package.json to prevent Sandpack crashes
    let finalSandpackFiles = sandpackFiles;
    let isPackageJsonValid = true;

    const pJson = finalSandpackFiles["/package.json"] || finalSandpackFiles["package.json"];
    if (pJson) {
        try {
            const trimmed = pJson.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                const parsed = JSON.parse(trimmed);
                if (!parsed || typeof parsed !== "object") {
                    throw new Error("Not an object");
                }
            } else {
                isPackageJsonValid = false;
            }
        } catch (e) {
            isPackageJsonValid = false;
            if (!isStreaming || pJson.includes("}")) {
                console.warn("[PreviewPanel] package.json is invalid, using fallback", e);
            }
        }
    }

    if (!isPackageJsonValid) {
        const { ["/package.json"]: _p1, ["package.json"]: _p2, ...rest } = finalSandpackFiles;
        finalSandpackFiles = rest;
    }

    // Filter out build-time Node-only/Tailwind packages to prevent Sandpack dependency resolution errors
    const excludedDependencies = [
        "tailwindcss",
        "postcss",
        "autoprefixer",
        "tailwindcss-animate",
    ];
    const filteredPackageDependencies = Object.fromEntries(
        Object.entries(packageDependencies).filter(
            ([key]) => !excludedDependencies.includes(key) && !key.startsWith("@tailwindcss/")
        )
    );

    const sandpackDependencies = {
        ...baseDependencies,
        ...filteredPackageDependencies,
    };

    if (isStreaming) {
        const tasksToDisplay = tasks && tasks.length > 0 ? tasks : [
            { description: "Understanding your request", status: "in_progress" as const },
            { description: "Generating files", status: "pending" as const },
            { description: "Preparing preview", status: "pending" as const },
        ];

        const completedCount = tasksToDisplay.filter(t => t.status === "completed").length;
        const totalCount = tasksToDisplay.length;
        const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-card text-card-foreground p-6 relative overflow-hidden">
                {/* Modern subtle background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent rounded-full blur-[80px] pointer-events-none animate-pulse duration-4000" />
                
                {/* Premium Glassmorphic Card */}
                <div className="relative z-10 w-full max-w-md bg-background/40 backdrop-blur-xl border border-primary/10 rounded-2xl p-8 shadow-[0_0_50px_rgba(109,156,255,0.15)] flex flex-col gap-6">
                    
                    {/* Header with animating icon */}
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4">
                            {/* Rotating background aura */}
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary via-accent to-primary opacity-30 blur-md animate-spin duration-10000" />
                            {/* Inner container */}
                            <div className="relative flex size-14 items-center justify-center rounded-full bg-background border border-primary/20 shadow-inner">
                                <Loader2 className="size-6 text-primary animate-spin" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75">
                            Building Project
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            AI is coding your project step-by-step
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                            <span>Overall Progress</span>
                            <span className="text-primary">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden border border-primary/5">
                            <div 
                                className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Tasks Checklist */}
                    <div className="space-y-3 bg-muted/10 border border-primary/5 rounded-xl p-4">
                        {tasksToDisplay.map((task, index) => {
                            const isCompleted = task.status === "completed";
                            const isInProgress = task.status === "in_progress";
                            
                            return (
                                <div 
                                    key={index}
                                    className={`flex items-center gap-3 transition-all duration-300 ${
                                        isInProgress 
                                            ? "text-foreground font-medium scale-[1.02]" 
                                            : isCompleted 
                                                ? "text-muted-foreground/80" 
                                                : "text-muted-foreground/45"
                                    }`}
                                >
                                    <div className="flex shrink-0 items-center justify-center size-5">
                                        {isCompleted ? (
                                            <CheckCircle2 className="size-5 text-emerald-400 fill-emerald-400/10 transition-all duration-300" />
                                        ) : isInProgress ? (
                                            <Loader2 className="size-4 text-primary animate-spin" />
                                        ) : (
                                            <Circle className="size-4 text-muted-foreground/30 stroke-[1.5]" />
                                        )}
                                    </div>
                                    <span className="text-sm tracking-wide">
                                        {task.description}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Subtle info footer */}
                    <div className="text-center text-[10px] text-muted-foreground/50 border-t border-primary/5 pt-4">
                        Do not close this page while generation is active.
                    </div>
                </div>
            </div>
        );
    }

    const showLoading = !hasFiles;

    if (showLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-card text-card-foreground">
                <div className="relative mb-6">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
                    <div className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-background shadow-lg">
                        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                    Waiting for files...
                </h3>
                <p className="mt-2 max-w-[280px] text-sm text-center text-muted-foreground">
                    Describe your project in the chat to start generating code.
                </p>
            </div>
        );
    }

    const sandpackKey = React.useMemo(() => {
        return `${Object.keys(finalSandpackFiles).length}-${Object.keys(packageDependencies).length}`;
    }, [finalSandpackFiles, packageDependencies]);

    return (
        <div className="h-full w-full relative group sandpack-stretch">

            {/* Fix Error overlay — shown only when there's a preview error and not streaming */}
            {previewError && !isStreaming && onFixError && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
                        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
                            <svg className="size-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">Preview Error</h3>
                            <p className="text-xs text-muted-foreground font-mono bg-muted rounded-md p-2 text-left max-h-24 overflow-auto">
                                {previewError}
                            </p>
                        </div>
                        <button
                            onClick={() => onFixError(previewError)}
                            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                            </svg>
                            Fix Error with AI
                        </button>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent("sandpack-error-dismiss"));
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <SandpackProvider
                key={sandpackKey}
                template="react-ts"
                theme="dark"
                files={finalSandpackFiles}
                customSetup={{
                    dependencies: sandpackDependencies,
                    entry: "/src/index.tsx",
                }}
                options={{
                    recompileMode: "immediate",
                    recompileDelay: 300,
                    externalResources: ["https://cdn.tailwindcss.com"],
                }}
            >
                <SandpackLayout style={{ height: "100%", width: "100%" }}>
                    <SandpackPreview
                        showOpenInCodeSandbox={false}
                        showRefreshButton={true}
                        style={{ height: "100%", width: "100%" }}
                    />
                </SandpackLayout>
                <SandpackErrorListener />
            </SandpackProvider>
        </div>
    );
}
