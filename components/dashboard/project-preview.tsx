"use client";

import { useSandpack, SandpackProvider, SandpackPreview, SandpackLayout } from "@codesandbox/sandpack-react";
import { useEffect, useRef } from "react";

export interface ProjectPreviewProps {
    files: Record<string, string>;
    onLoad?: () => void;
}

const VIRTUAL_WIDTH = 1024;
const VIRTUAL_HEIGHT = 640;

function toSandpackFiles(
    files: Record<string, string>
): Record<string, { code: string }> {
    const sandpackFiles: Record<string, { code: string }> = {};

    for (const [path, content] of Object.entries(files)) {
        const sandpackPath = path.startsWith("src/")
            ? `/${path.slice(4)}`
            : `/${path}`;
        sandpackFiles[sandpackPath] = { code: content };
    }

    return sandpackFiles;
}

function extractDependencies(
    files: Record<string, string>
): Record<string, string> {
    const baseDeps: Record<string, string> = {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
    };

    const packageJsonContent = files["package.json"];
    if (!packageJsonContent) {
        return baseDeps;
    }

    try {
        const parse = JSON.parse(packageJsonContent);
        return { ...baseDeps, ...(parse.dependencies || {}) };
    } catch (error) {
        return baseDeps;
    }
}

function LoadNotifier({ onLoad }: { onLoad?: () => void }) {
    const { listen } = useSandpack();

    useEffect(() => {
        if (!onLoad) return;

        const unsubscribe = listen((message) => {
            if (message.type === "done") {
                onLoad();
            }
        });

        return unsubscribe;
    }, [listen, onLoad]);
    return null;
}

export function ProjectPreview({ files, onLoad }: ProjectPreviewProps) {
    const sandpackFiles = toSandpackFiles(files);
    const dependencies = extractDependencies(files);

    return (
        <div
            className="origin-top-left"
            style={{ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }}
        >
            <div className="sandpack-stretch h-full w-full">
                <SandpackProvider
                    template="react-ts"
                    theme="dark"
                    files={sandpackFiles}
                    options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
                    customSetup={{ dependencies }}
                >
                    <LoadNotifier onLoad={onLoad} />

                    <SandpackLayout
                        style={{ height: "100%", border: "none", borderRadius: 0 }}
                    >
                        <SandpackPreview
                            showNavigator={false}
                            showOpenInCodeSandbox={false}
                            showRefreshButton={false}
                            style={{ height: "100%" }}
                        />
                    </SandpackLayout>
                </SandpackProvider>
            </div>
        </div>
    );
}