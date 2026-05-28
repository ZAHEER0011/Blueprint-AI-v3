"use client"

import React, { useState, useEffect, useCallback } from "react";
import { DeviceMode, DeviceToggle } from "./device-toggle";
import { EditorTabValue } from "./editor-tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectMenu } from "./project-menu";
import { EditorTabs } from "./editor-tabs";
import { Download, ExternalLink, Eye, Loader2, MessageSquare, Github, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { UserButton, useAuth } from "@clerk/nextjs";
import { zipSync, strToU8 } from "fflate";
import { createApiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface EditorHeaderProps {
    projectName: string;
    files: Record<string, string>;
    activeTab: EditorTabValue;
    onTabChange: (tab: EditorTabValue) => void;
    mobilePanel: "chat" | "content";
    onMobilePanelChange: (panel: "chat" | "content") => void;
    projectId: string;
    userPlan: "free" | "pro";
    creditsRemaining?: number;
    creditsTotal?: number;
    onRename: (newName: string) => void;
    onDelete: () => void;
    deviceMode: DeviceMode;
    onDeviceModeChange: (mode: DeviceMode) => void;
}


export function EditorHeader({
    projectName,
    files,
    activeTab,
    onTabChange,
    mobilePanel,
    onMobilePanelChange,
    projectId,
    userPlan,
    creditsRemaining,
    creditsTotal,
    onRename,
    onDelete,
    deviceMode,
    onDeviceModeChange,
}: EditorHeaderProps) {

    const router = useRouter()
    const [isOpening, setIsOpening] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const { getToken } = useAuth()

    // GitHub integration states
    const [ghConnected, setGhConnected] = useState(false)
    const [ghUsername, setGhUsername] = useState<string | null>(null)
    const [ghLoading, setGhLoading] = useState(true)

    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
    const [isNotConnectedOpen, setIsNotConnectedOpen] = useState(false)
    const [repoName, setRepoName] = useState("")
    const [repoDesc, setRepoDesc] = useState("")
    const [isPrivate, setIsPrivate] = useState(false)

    const [isSyncing, setIsSyncing] = useState(false)
    const [syncStep, setSyncStep] = useState<"idle" | "creating" | "uploading" | "success" | "error">("idle")
    const [syncProgress, setSyncProgress] = useState(0)
    const [syncError, setSyncError] = useState("")
    const [createdRepoUrl, setCreatedRepoUrl] = useState("")

    const checkGithubStatus = useCallback(async () => {
        try {
            setGhLoading(true);
            const client = createApiClient(getToken);
            const res = await client.settings.getGithub();
            setGhConnected(res.connected);
            if (res.connected && res.username) {
                setGhUsername(res.username);
            }
        } catch (err) {
            console.error("Failed to check GitHub status in editor header:", err);
        } finally {
            setGhLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        if (projectId) {
            checkGithubStatus();
        }

        const handleStatusChange = () => checkGithubStatus();
        window.addEventListener("github-status-changed", handleStatusChange);
        return () => window.removeEventListener("github-status-changed", handleStatusChange);
    }, [projectId, checkGithubStatus]);

    useEffect(() => {
        if (projectName) {
            const formatted = projectName
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");
            setRepoName(formatted || "project");
        }
    }, [projectName]);

    const handleGithubClick = () => {
        if (ghConnected) {
            setIsSyncModalOpen(true);
            setSyncStep("idle");
            setSyncProgress(0);
            setSyncError("");
        } else {
            const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
            if (!clientId) {
                toast.error("GitHub Client ID is not configured. Redirecting to settings page...");
                setTimeout(() => {
                    router.push("/settings?tab=integrations");
                }, 1500);
                return;
            }
            const callbackUrl = encodeURIComponent(window.location.origin + "/auth/github/callback");
            const scope = "repo";
            // Pass the projectId as state to allow returning to the editor page after authorization
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${callbackUrl}&state=${projectId}`;
        }
    };

    const handleGithubSync = async () => {
        try {
            setIsSyncing(true);
            setSyncStep("creating");
            setSyncError("");
            setSyncProgress(10);

            const client = createApiClient(getToken);

            // 1. Fetch GitHub PAT token
            const { token: pat } = await client.settings.getGithubToken();
            if (!pat) {
                throw new Error("GitHub connection token not found. Please reconnect.");
            }

            // 2. Create Repository
            const createResponse = await fetch("https://api.github.com/user/repos", {
                method: "POST",
                headers: {
                    Authorization: `token ${pat}`,
                    "Content-Type": "application/json",
                    "User-Agent": "Blueprint-AI-Client",
                },
                body: JSON.stringify({
                    name: repoName,
                    description: repoDesc || `Generated by WebCraft`,
                    private: isPrivate,
                    auto_init: false,
                }),
            });

            if (!createResponse.ok) {
                const errBody = await createResponse.json().catch(() => ({}));
                throw new Error(errBody.message || "Failed to create repository. Make sure repository name is unique on your profile.");
            }

            const repoData = (await createResponse.json()) as { html_url: string };
            setCreatedRepoUrl(repoData.html_url);

            setSyncStep("uploading");
            setSyncProgress(30);

            // 3. Prepare the files list (applying exact clean logic as zip export)
            const processedFiles: Record<string, string> = {};

            for (const [path, content] of Object.entries(files)) {
                let cleanPath = path.startsWith("/") ? path.slice(1) : path;
                if (cleanPath === "index.html") {
                    cleanPath = "public/index.html";
                }

                let fileContent = content;
                if (cleanPath === "package.json") {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && parsed.scripts) {
                            if (!parsed.scripts.dev && parsed.scripts.start) {
                                parsed.scripts.dev = parsed.scripts.start;
                            }
                        }
                        fileContent = JSON.stringify(parsed, null, 2);
                    } catch {}
                }

                processedFiles[cleanPath] = fileContent;
            }

            // Auto inject public/index.html if missing
            const hasIndexHtml = Object.keys(processedFiles).some(
                (p) => p === "public/index.html" || p === "index.html"
            );
            if (!hasIndexHtml) {
                const envVars: Record<string, string> = {};
                const envFileKeys = [".env", ".env.local", "/.env", "/.env.local"];
                for (const key of envFileKeys) {
                    if (files[key]) {
                        const lines = files[key].split("\n");
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith("#")) continue;
                            const eqIdx = trimmed.indexOf("=");
                            if (eqIdx === -1) continue;
                            const k = trimmed.slice(0, eqIdx).trim();
                            let v = trimmed.slice(eqIdx + 1).trim();
                            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                                v = v.slice(1, -1);
                            }
                            envVars[k] = v;
                        }
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

                const defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
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

                processedFiles["public/index.html"] = defaultIndexHtml;
            }

            // Auto inject tsconfig.json if missing
            const hasTsConfig = Object.keys(processedFiles).some((p) => p === "tsconfig.json");
            if (!hasTsConfig) {
                const defaultTsConfig = {
                    compilerOptions: {
                        target: "es5",
                        lib: ["dom", "dom.iterable", "esnext"],
                        allowJs: true,
                        skipLibCheck: true,
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true,
                        strict: true,
                        forceConsistentCasingInFileNames: true,
                        noFallthroughCasesInSwitch: true,
                        module: "esnext",
                        moduleResolution: "node",
                        resolveJsonModule: true,
                        isolatedModules: true,
                        noEmit: true,
                        jsx: "react-jsx"
                    },
                    include: ["src"]
                };
                processedFiles["tsconfig.json"] = JSON.stringify(defaultTsConfig, null, 2);
            }

            // 4. Commit and push files one by one to GitHub repo
            const entries = Object.entries(processedFiles);
            const totalFiles = entries.length;
            let uploaded = 0;

            for (const [filePath, fileContent] of entries) {
                const base64 = btoa(unescape(encodeURIComponent(fileContent)));

                const uploadRes = await fetch(`https://api.github.com/repos/${ghUsername}/${repoName}/contents/${filePath}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `token ${pat}`,
                        "Content-Type": "application/json",
                        "User-Agent": "Blueprint-AI-Client",
                    },
                    body: JSON.stringify({
                        message: `Add ${filePath} via WebCraft`,
                        content: base64,
                    }),
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json().catch(() => ({}));
                    throw new Error(err.message || `Failed to upload ${filePath} to repository.`);
                }

                uploaded++;
                setSyncProgress(30 + Math.floor((uploaded / totalFiles) * 65));
            }

            setSyncProgress(100);
            setSyncStep("success");
            toast.success("Successfully synchronized code to GitHub!");
        } catch (error: any) {
            console.error("Failed syncing to GitHub:", error);
            setSyncError(error.message || "An unknown error occurred during upload.");
            setSyncStep("error");
        } finally {
            setIsSyncing(false);
        }
    };

    function handleOpenPreview() {
        window.open(`/preview/${projectId}`, '_blank');
    }

    function handleExport() {
        try {
            setIsExporting(true);
            
            const zipData: Record<string, Uint8Array> = {};
            
            // 1. Process existing files
            for (const [path, content] of Object.entries(files)) {
                // Remove leading slash if present for valid zip structure
                let cleanPath = path.startsWith("/") ? path.slice(1) : path;
                
                // If it is index.html in the root, move it to public/index.html
                if (cleanPath === "index.html") {
                    cleanPath = "public/index.html";
                }
                
                let fileContent = content;
                
                // Safety check for package.json scripts so dev script is always present
                if (cleanPath === "package.json") {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && parsed.scripts) {
                            if (!parsed.scripts.dev && parsed.scripts.start) {
                                parsed.scripts.dev = parsed.scripts.start;
                            }
                        }
                        fileContent = JSON.stringify(parsed, null, 2);
                    } catch (e) {
                        console.warn("Failed to check/modify package.json scripts for export", e);
                    }
                }
                
                zipData[cleanPath] = strToU8(fileContent);
            }
            
            // 2. Check if index.html is missing
            const hasIndexHtml = Object.keys(zipData).some(
                (p) => p === "public/index.html" || p === "index.html"
            );
            
            if (!hasIndexHtml) {
                // Parse environment variables for injection
                const envVars: Record<string, string> = {};
                const envFileKeys = [".env", ".env.local", "/.env", "/.env.local"];
                for (const key of envFileKeys) {
                    if (files[key]) {
                        const lines = files[key].split("\n");
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith("#")) continue;
                            const eqIdx = trimmed.indexOf("=");
                            if (eqIdx === -1) continue;
                            const k = trimmed.slice(0, eqIdx).trim();
                            let v = trimmed.slice(eqIdx + 1).trim();
                            if (
                                (v.startsWith('"') && v.endsWith('"')) ||
                                (v.startsWith("'") && v.endsWith("'"))
                            ) {
                                v = v.slice(1, -1);
                            }
                            envVars[k] = v;
                        }
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

                const defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
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

                zipData["public/index.html"] = strToU8(defaultIndexHtml);
            }
            
            // 3. Check if tsconfig.json is missing
            const hasTsConfig = Object.keys(zipData).some(
                (p) => p === "tsconfig.json"
            );
            
            if (!hasTsConfig) {
                const defaultTsConfig = {
                    compilerOptions: {
                        target: "es5",
                        lib: ["dom", "dom.iterable", "esnext"],
                        allowJs: true,
                        skipLibCheck: true,
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true,
                        strict: true,
                        forceConsistentCasingInFileNames: true,
                        noFallthroughCasesInSwitch: true,
                        module: "esnext",
                        moduleResolution: "node",
                        resolveJsonModule: true,
                        isolatedModules: true,
                        noEmit: true,
                        jsx: "react-jsx"
                    },
                    include: ["src"]
                };
                zipData["tsconfig.json"] = strToU8(JSON.stringify(defaultTsConfig, null, 2));
            }
            
            const zipped = zipSync(zipData);
            const blob = new Blob([zipped], { type: "application/zip" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            const safeName = projectName.toLowerCase().replace(/[^a-z0-9_-]/gi, "_") || "project";
            link.download = `${safeName}.zip`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed:", err);
            alert("Failed to export project: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsExporting(false);
        }
    }
    return (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-1.5 sm:px-3">
            <div className="flex items-center gap-1.5 sm:gap-3">
                <Link
                    href="/dashboard"
                    className="shrink-0 transition-opacity duration-150 hover:opacity-80"
                    aria-label="Go to dashboard"
                >
                    <img
                        src="/logo.png"
                        alt="WebCraft"
                        className="size-6 sm:size-7"
                    />
                </Link>
                <div className="flex flex-col">
                    <ProjectMenu
                        projectName={projectName}
                        projectId={projectId}
                        creditsRemaining={creditsRemaining}
                        creditsTotal={creditsTotal}
                        userPlan={userPlan}
                        onRename={onRename}
                        onDelete={onDelete}
                    />
                    <span className="px-1 text-[10px] text-muted-foreground sm:text-[11px]">
                        Previewing last saved version
                    </span>
                </div>
            </div>

            {/* Center: Tabs */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
                <EditorTabs activeTab={activeTab} onTabChange={onTabChange} />

                <div className="mx-auto md:hidden">
                    <div className="flex items-center gap-0.5 rounded-full bg-secondary/60 p-0.5">

                        {/* Chat tab */}
                        <button
                            onClick={() => onMobilePanelChange("chat")}
                            className={cn(
                                "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                mobilePanel === "chat"
                                    ? "bg-foreground text-background shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <MessageSquare className="size-3" />
                            Chat
                        </button>

                        {/* Preview tab */}
                        <button
                            onClick={() => {
                                onTabChange("preview");
                                onMobilePanelChange("content");
                            }}
                            className={cn(
                                "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                mobilePanel === "content"
                                    ? "bg-foreground text-background shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Eye className="size-3" />
                            Preview
                        </button>

                    </div>
                </div>


            </div>

            {/* Right side - can be used for other buttons later */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                {
                    activeTab === "preview" && (
                        <div className="hidden md:flex items-center gap-1.5">
                            <DeviceToggle
                                deviceMode={deviceMode}
                                onDeviceModeChange={onDeviceModeChange}
                            />

                        </div>
                    )
                }

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPreview}
                    disabled={isOpening}
                    className="gap-1.5 text-xs"
                    title="Open live preview in new tab"
                >
                    {isOpening ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <ExternalLink className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">Preview</span>
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="gap-1.5 text-xs"
                >
                    {isExporting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <Download className="size-3.5" />
                    )}
                    <span>Export</span>
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGithubClick}
                    disabled={isSyncing}
                    className="gap-1.5 text-xs border-primary/20 hover:border-primary/45 hover:bg-primary/5 text-foreground"
                    title={ghConnected ? "Sync and push project files to a GitHub repository" : "Connect your GitHub account in settings to sync"}
                >
                    {isSyncing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <Github className="size-3.5 text-primary" />
                    )}
                    <span className="hidden sm:inline">
                        {ghConnected ? "Push to GitHub" : "Connect GitHub"}
                    </span>
                    <span className="inline sm:hidden">
                        {ghConnected ? "Push" : "Connect"}
                    </span>
                </Button>

                <UserButton
                    afterSignOutUrl="/"
                    appearance={
                        {
                            elements: {
                                avatarBox: "size-6 sm:size-7"
                            }
                        }
                    }
                />


            </div>

            {/* Modal: GitHub NOT Connected */}
            {isNotConnectedOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl relative animate-in scale-in duration-200">
                        <button 
                            onClick={() => setIsNotConnectedOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xs"
                        >
                            ✕
                        </button>
                        <div className="flex flex-col items-center text-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                <AlertCircle className="size-6" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">GitHub Account Not Connected</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                To sync your project directly to GitHub repositories, please connect your GitHub account in your settings first.
                            </p>
                        </div>
                        <div className="flex gap-2.5 mt-5">
                            <Button 
                                variant="outline" 
                                className="flex-1 text-xs" 
                                onClick={() => setIsNotConnectedOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                className="flex-1 text-xs font-bold gap-1"
                                onClick={() => {
                                    setIsNotConnectedOpen(false);
                                    window.open("/settings?tab=integrations", "_blank");
                                }}
                            >
                                Connect GitHub
                                <ArrowUpRight className="size-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: GitHub Sync Form & Progress */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl relative animate-in scale-in duration-200">
                        
                        {!isSyncing && (
                            <button 
                                onClick={() => {
                                    setIsSyncModalOpen(false);
                                    setSyncStep("idle");
                                }}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xs"
                            >
                                ✕
                            </button>
                        )}

                        <h3 className="text-base font-bold flex items-center gap-2 mb-1.5 text-foreground">
                            <Github className="size-5 text-primary" />
                            Sync Workspace to GitHub
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            This will create a new repository under your account and push all code files.
                        </p>

                        {syncStep === "idle" && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Repository Name
                                    </label>
                                    <input
                                        type="text"
                                        value={repoName}
                                        onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "-"))}
                                        placeholder="repo-name"
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        maxLength={100}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Description (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={repoDesc}
                                        onChange={(e) => setRepoDesc(e.target.value)}
                                        placeholder="Generated by WebCraft"
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        maxLength={200}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-foreground">Private Repository</span>
                                        <span className="text-[10px] text-muted-foreground">Limit visibility to yourself</span>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={isPrivate}
                                        onChange={(e) => setIsPrivate(e.target.checked)}
                                        className="size-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
                                    />
                                </div>

                                <div className="flex gap-2.5 mt-5">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 text-xs" 
                                        onClick={() => setIsSyncModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        className="flex-1 text-xs font-bold gap-1.5"
                                        onClick={handleGithubSync}
                                        disabled={!repoName.trim()}
                                    >
                                        Create & Sync Repo
                                    </Button>
                                </div>
                            </div>
                        )}

                        {(syncStep === "creating" || syncStep === "uploading") && (
                            <div className="py-6 flex flex-col items-center gap-4 text-center">
                                <Loader2 className="size-8 text-primary animate-spin" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        {syncStep === "creating" ? "Creating new repository..." : "Uploading project files..."}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground">
                                        This should only take a few seconds
                                    </p>
                                </div>
                                <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden mt-2">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                                        style={{ width: `${syncProgress}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-primary">{syncProgress}%</span>
                            </div>
                        )}

                        {syncStep === "success" && (
                            <div className="py-6 flex flex-col items-center gap-4 text-center">
                                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    <CheckCircle2 className="size-7" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">Sync Completed Successfully!</h4>
                                    <p className="text-xs text-muted-foreground">
                                        All files have been successfully pushed to your repository.
                                    </p>
                                </div>
                                <div className="flex gap-2.5 mt-5 w-full">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 text-xs" 
                                        onClick={() => {
                                            setIsSyncModalOpen(false);
                                            setSyncStep("idle");
                                        }}
                                    >
                                        Close
                                    </Button>
                                    <Button 
                                        className="flex-1 text-xs font-bold gap-1"
                                        onClick={() => window.open(createdRepoUrl, "_blank")}
                                    >
                                        Open Repository
                                        <ArrowUpRight className="size-3" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {syncStep === "error" && (
                            <div className="py-6 flex flex-col items-center gap-4 text-center">
                                <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 text-destructive">
                                    <AlertCircle className="size-7" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">GitHub Sync Failed</h4>
                                    <p className="text-xs text-destructive bg-destructive/5 rounded-lg border border-destructive/10 p-2.5 max-h-24 overflow-y-auto max-w-xs font-mono text-left">
                                        {syncError}
                                    </p>
                                </div>
                                <div className="flex gap-2.5 mt-5 w-full">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 text-xs" 
                                        onClick={() => setSyncStep("idle")}
                                    >
                                        Try Again
                                    </Button>
                                    <Button 
                                        className="flex-1 text-xs font-bold"
                                        onClick={() => {
                                            setIsSyncModalOpen(false);
                                            setSyncStep("idle");
                                        }}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
