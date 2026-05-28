import React, { useEffect } from "react";
import Editor from "@monaco-editor/react";
import { FileTree } from "./file-tree";

interface CodeEditorProps {
    files: Record<string, string>;
    activeFile: string;
    onActiveFileChange: (path: string) => void;
    onFileChange: (path: string, content: string) => void;
}

export function CodeEditor({
    files,
    activeFile,
    onActiveFileChange,
    onFileChange,
}: CodeEditorProps) {
    useEffect(() => {
        // Monaco emits "Canceled: Canceled" rejections when models switch quickly.
        // They are expected and should not surface as noisy unhandled errors.
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = String(event.reason ?? "");
            if (reason.includes("Canceled: Canceled")) {
                event.preventDefault();
            }
        };

        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        return () =>
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    }, []);

    // Determine language from extension
    const getLanguage = (path: string) => {
        if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
        if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
        if (path.endsWith(".css")) return "css";
        if (path.endsWith(".html")) return "html";
        if (path.endsWith(".json")) return "json";
        return "plaintext";
    };

    return (
        <div className="flex h-full w-full">
            {/* File Tree Sidebar - VS Code Style */}
            <FileTree
                files={files}
                activeFile={activeFile}
                onActiveFileChange={onActiveFileChange}
            />

            {/* Monaco Editor */}
            <div className="flex-1 h-full bg-[#1e1e1e]">
                {activeFile && files[activeFile] !== undefined ? (
                    <Editor
                        height="100%"
                        language={getLanguage(activeFile)}
                        theme="vs-dark"
                        value={files[activeFile]}
                        path={activeFile}
                        onChange={(value) => onFileChange(activeFile, value || "")}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: "on",
                            padding: { top: 16 },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                        }}
                        onMount={(editor, monaco) => {
                            // Disable TypeScript/JavaScript validation completely
                            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                                noSemanticValidation: true,
                                noSyntaxValidation: true,
                                noSuggestionDiagnostics: true,
                            });
                            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                                noSemanticValidation: true,
                                noSyntaxValidation: true,
                                noSuggestionDiagnostics: true,
                            });
                            // Disable error markers
                            monaco.editor.setModelMarkers(editor.getModel()!, "owner", []);
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select a file to edit
                    </div>
                )}
            </div>
        </div>
    );
}
