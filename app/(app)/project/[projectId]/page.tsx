"use client"
import { EditorLayout } from "@/components/editor";
import { createApiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_MODEL_ID, getModelById } from "@/lib/models";
import { ChatMessage, ImageAttachment } from "@/types/chat";
import { Project, ProjectFile, VersionMeta } from "@/types/project";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WORKER_URL } from "@/lib/api-client";
import { CodeEditor } from "@/components/editor/code-editor";
import { PreviewPanel } from "@/components/editor/preview-panel";

function stripMarkdownFences(content: string): string {
    const lines = content.split("\n");

    // Strip opening fence if first line matches ```lang or ```
    if (lines.length > 0 && /^\s*```[a-zA-Z]*\s*$/.test(lines[0])) {
        lines.shift();
    }

    // Strip trailing empty lines, then closing fence
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    if (lines.length > 0 && /^\s*```\s*$/.test(lines[lines.length - 1])) {
        lines.pop();
    }

    return lines.join("\n");
}

/**
 * Converts a ProjectFile[] array to a Record<string, string>.
 * This is the format expected by Sandpack and Monaco.
 * Also strips any markdown code fences from file content.
 *
 * @param files - Array of ProjectFile objects from the API
 * @returns Object mapping file paths to their content
 */
function filesToRecord(files: ProjectFile[]): Record<string, string> {
    const record: Record<string, string> = {};

    for (const file of files) {
        const cleaned = stripMarkdownFences(file.content);
        record[file.path] = cleaned;
    }

    return record;
}

const EditorPage = ({ params }: { params: Promise<{ projectId: string }> }) => {
    const { projectId } = use(params);
    const { getToken } = useAuth();
    const router = useRouter();
    const client = createApiClient(getToken);

    // --- Preview error state for manual fix ---
    const [previewError, setPreviewError] = useState<string | null>(null);

    /** Mirror of isStreaming as a ref — avoids stale closures in callbacks */
    const isStreamingRef = useRef(false);

    /**
     * Stores a pending prompt from sessionStorage (set during project creation).
     * Consumed once after the editor finishes loading to auto-send the first message.
     */
    const pendingPromptRef = useRef<string | null>(null);

    /**
     * Ref that always holds the latest handleSendMessage callback.
     * Used by the auto-send effect to avoid stale closure issues
     * without needing handleSendMessage in the effect's deps.
     */
    const handleSendMessageRef = useRef<(content: string, images?: ImageAttachment[], selectedFiles?: string[]) => void>(() => { });

    const [project, setProject] = useState<Project | null>(null);

    /** File contents — Record<filePath, content> */
    const [files, setFiles] = useState<Record<string, string>>({});

    /** Currently selected file in Monaco editor */
    const [activeFile, setActiveFile] = useState<string>("src/App.tsx");

    /** Chat message history */
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    /** Whether AI is currently generating a response */
    const [isStreaming, setIsStreaming] = useState(false);

    /** Live stream tasks for the loading screen */
    const [currentTasks, setCurrentTasks] = useState<
        Array<{ description: string; status: "pending" | "in_progress" | "completed" }>
    >([]);


    /** Loading state while fetching project data */
    const [isLoading, setIsLoading] = useState(true);

    /** Version history metadata for the timeline */
    const [versions, setVersions] = useState<VersionMeta[]>([]);

    /** Whether versions are still loading */
    const [isLoadingVersions, setIsLoadingVersions] = useState(true);

    /** User's remaining credits (-1 = unlimited, undefined = loading) */
    const [creditsRemaining, setCreditsRemaining] = useState<number | undefined>(
        undefined
    );

    /** Total credits for the billing period (e.g. 50 for free) */
    const [creditsTotal, setCreditsTotal] = useState<number>(50);

    /** User's current plan — determines model access */
    const [userPlan, setUserPlan] = useState<"free" | "pro">("free");

    /** Currently selected AI model ID */
    const [selectedModelId, setSelectedModelId] =
        useState<string>(DEFAULT_MODEL_ID);

    /** Whether the user has exhausted their free credits */
    const isCreditsExhausted =
        creditsRemaining !== undefined &&
        creditsRemaining !== -1 &&
        creditsRemaining <= 0;

    /**
     * Which old version the user is currently viewing (null = current).
     * When viewing an old version, the editor shows those files read-only.
     */
    const [viewingVersion, setViewingVersion] = useState<number | null>(null);
    const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

    /**
 * Saved files for the current version — used to restore when
 * the user clicks "Back to current" after viewing an old version.
 */
    const currentFilesRef = useRef<Record<string, string>>({});

    /**
     * Diff state — when set, the history panel shows the diff viewer
     * instead of the timeline.
     */
    const [diffState, setDiffState] = useState<{
        from: number;
        to: number;
        changes: Array<{
            path: string;
            type: "added" | "removed" | "modified";
            oldContent: string | null;
            newContent: string | null;
        }>;
    } | null>(null);

    const refreshVersions = useCallback(async () => {
        try {
            setIsLoadingVersions(true);
            const response = await client.versions.list(projectId);
            setVersions(response.versions);
        } catch (error) {
            console.error("Failed to refresh versions:", error);
        } finally {
            setIsLoadingVersions(false);
        }
    }, [projectId, client.versions]);

    const handleBackToCurrent = useCallback(() => {
        setViewingVersion(null);
        if (Object.keys(currentFilesRef.current).length > 0) {
            setFiles(currentFilesRef.current);
        }
    }, []);

    const handleSendMessage = useCallback(
        async (
            content: string,
            images?: ImageAttachment[],
            selectedFiles?: string[],
        ) => {
            if (isStreamingRef.current) {
                console.warn("[handleSendMessage] Stream already in progress. Ignoring duplicate request.");
                return;
            }

            // If user was viewing old version → jump to latest
            if (viewingVersion !== project?.currentVersion) {
                handleBackToCurrent?.();
            }

            // ---- USER MESSAGE ----
            const userMessage: ChatMessage = {
                id: `msg-${Date.now()}-user`,
                role: "user",
                content,
                timestamp: new Date().toISOString(),
                images: images && images.length > 0 ? images : undefined,
                selectedFiles: selectedFiles && selectedFiles.length > 0 ? selectedFiles : undefined,
            };

            setMessages((prev) => [...prev, userMessage]);

            setIsStreaming(true);
            isStreamingRef.current = true;

            // ---- INITIALIZE STREAM TASKS ----
            const initialTasks = [
                { description: "Understanding your request", status: "in_progress" as const },
                { description: "Generating files", status: "pending" as const },
                { description: "Preparing preview", status: "pending" as const },
            ];
            setCurrentTasks(initialTasks);

            // ---- EMPTY AI MESSAGE ----
            const aiMessageId = `msg-${Date.now()}-assistant`;

            const aiMessage: ChatMessage = {
                id: aiMessageId,
                role: "assistant",
                content:
                    '<task status="in_progress">Understanding your request</task>\n' +
                    '<task status="pending">Generating files</task>\n' +
                    '<task status="pending">Preparing preview</task>',
                timestamp: new Date().toISOString(),
                model: selectedModelId,
            };

            setMessages((prev) => [...prev, aiMessage]);

            try {
                const token = await getToken();
                if (!token) throw new Error("Not authenticated");

                const response = await fetch(
                    `${WORKER_URL}/api/chat/${projectId}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            prompt: content,
                            model: selectedModelId,
                            images: images && images.length > 0 ? images : undefined,
                            selectedFiles: selectedFiles && selectedFiles.length > 0 ? selectedFiles : undefined,
                        }),
                    }
                );

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({
                        error: "Request failed",
                    }));

                    throw new Error(errorBody.error || "Request failed");
                }

                if (!response.body) {
                    throw new Error("No response body");
                }

                // ---- STREAM READER ----
                // ---- STREAM READER ----
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let chunkCount = 0;
                const startTime = Date.now();
                const taskStatusByDescription = new Map<string, "pending" | "in_progress" | "completed">();

                const buildTaskMarkup = () =>
                    Array.from(taskStatusByDescription.entries())
                        .map(
                            ([description, status]) =>
                                `<task status="${status}">${description}</task>`
                        )
                        .join("\n");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    chunkCount++;

                    // Check for timeout (60 seconds without any data)
                    if (Date.now() - startTime > 60000 && chunkCount === 0) {
                        console.error("[SendMessage] Stream timeout - no data received");
                        throw new Error("Generation timed out. The AI service may be unavailable.");
                    }

                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;

                        const data = line.slice(6).trim();
                        if (!data) continue;

                        try {
                            const event = JSON.parse(data);

                            // Skip heartbeat/ping events
                            if (event.time !== undefined) {
                                continue;
                            }

                            // ---- CONNECTION CONFIRMED ----
                            if (event.text === "Stream started") {
                                continue;
                            }

                            // ---- STREAM TEXT ----
                            if (event.text !== undefined) {
                                // Ignore raw code text in chat UI.
                                // We only show task placeholders + final explanation.
                            }

                            if (event.status && event.description) {
                                taskStatusByDescription.set(event.description, event.status);

                                // Update currentTasks state for PreviewPanel
                                setCurrentTasks((prev) => {
                                    const index = prev.findIndex(t => t.description === event.description);
                                    if (index !== -1) {
                                        const newTasks = [...prev];
                                        newTasks[index] = { description: event.description, status: event.status };
                                        return newTasks;
                                    } else {
                                        const previewIndex = prev.findIndex(t => t.description === "Preparing preview");
                                        if (previewIndex !== -1) {
                                            const newTasks = [...prev];
                                            newTasks.splice(previewIndex, 0, { description: event.description, status: event.status });
                                            return newTasks;
                                        }
                                        return [...prev, { description: event.description, status: event.status }];
                                    }
                                });

                                const tasksMarkup = buildTaskMarkup();
                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === aiMessageId
                                            ? { ...msg, content: tasksMarkup }
                                            : msg
                                    )
                                );
                            }

                            // ---- FILES GENERATED ----
                            if (event.files && !event.isPartial) {
                                const newFiles = filesToRecord(event.files);
                                setFiles(newFiles);
                                currentFilesRef.current = newFiles;
                                lastSavedFilesRef.current = newFiles;
                                // Clear any preview error when new files arrive
                                setPreviewError(null);
                            }

                            if (event.event === "error") {
                                console.error("[SSE] Error event received:", event.data);
                                toast.error(event.data.text || "AI generation error");
                                setIsStreaming(false);
                                isStreamingRef.current = false;
                                return;
                            }

                            // ---- DONE ----
                            if (event.versionId || event.model) {

                                // Set all tasks to completed in currentTasks state
                                setCurrentTasks((prev) =>
                                    prev.map((t) => ({ ...t, status: "completed" as const }))
                                );

                                const tasksMarkup = buildTaskMarkup();
                                const changedCount = Array.isArray(event.changedFiles)
                                    ? event.changedFiles.length
                                    : 0;
                                const completionNote =
                                    changedCount > 0
                                        ? `Build complete. Updated ${changedCount} files and synced preview.`
                                        : "Build complete. Project synced to editor and preview.";
                                const finalContent = `${tasksMarkup}\n\n${completionNote}`;

                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === aiMessageId
                                            ? { ...msg, content: finalContent || "Generation completed." }
                                            : msg
                                    )
                                );
                            }

                            // ---- CREDITS ----
                            if (event.creditsRemaining !== undefined) {
                                setCreditsRemaining(event.creditsRemaining);
                            }

                            // ---- VERSION ----
                            if (event.versionId) {
                                setProject((prev) =>
                                    prev
                                        ? {
                                            ...prev,
                                            currentVersion: prev.currentVersion + 1,
                                            updatedAt: new Date().toISOString(),
                                        }
                                        : prev
                                );

                                const versionNumber = parseInt(
                                    event.versionId.replace("v", ""),
                                    10
                                );

                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === aiMessageId
                                            ? { ...msg, versionNumber }
                                            : msg
                                    )
                                );

                                refreshVersions?.();
                            }

                            // ---- RATE LIMIT ----
                            if (event.code === "RATE_LIMITED") {
                                setRateLimitedUntil(Date.now() + 60000);

                                window.dispatchEvent(
                                    new CustomEvent("rate-limited", {
                                        detail: { retryAfter: 60 },
                                    })
                                );
                            }

                            // ---- ERROR FROM STREAM ----
                            if (event.error || (event.code && event.versionId === undefined)) {
                                const msg = event.message || event.error || "Unknown error";
                                const code = event.code || "UNKNOWN";

                                console.error("[SSE] Error received:", code, msg);

                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === aiMessageId
                                            ? { ...m, content: `Error (${code}): ${msg}` }
                                            : m
                                    )
                                );

                                toast.error(`${code}: ${msg}`);
                            }
                        } catch {
                            // Ignore bad chunks
                        }
                    }
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Something went wrong";

                const lower = errorMessage.toLowerCase();

                if (
                    lower.includes("too many requests") ||
                    lower.includes("rate limit")
                ) {
                    setRateLimitedUntil(Date.now() + 60000);

                    window.dispatchEvent(
                        new CustomEvent("rate-limited", {
                            detail: { retryAfter: 60 },
                        })
                    );
                }

                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId
                            ? { ...msg, content: `Error: ${errorMessage}` }
                            : msg
                    )
                );

                toast.error(errorMessage);
            } finally {
                setIsStreaming(false);
                isStreamingRef.current = false;
            }
        },
        [
            project,
            projectId,
            selectedModelId,
            getToken,
            viewingVersion,
            handleBackToCurrent,
            refreshVersions,
        ]
    );

    useEffect(() => {
        handleSendMessageRef.current = handleSendMessage;
    }, [handleSendMessage]);

    useEffect(() => {
        if (!isLoading && pendingPromptRef.current) {
            const prompt = pendingPromptRef.current;
            pendingPromptRef.current = null;
            
            // Wait slightly for handleSendMessageRef to be populated by the other useEffect
            setTimeout(() => {
                if (handleSendMessageRef.current) {
                    handleSendMessageRef.current(prompt);
                }
            }, 500);
        }
    }, [isLoading]);

    // ------------------------------------------------------------
    // Preview error listener — manual fix button
    // ------------------------------------------------------------
    useEffect(() => {
        const handleSandpackError = (event: Event) => {
            const customEvent = event as CustomEvent<{ error: string }>;
            // Only capture error after streaming is done
            if (isStreamingRef.current) return;
            setPreviewError(customEvent.detail.error);
        };

        const handleDismiss = () => setPreviewError(null);

        window.addEventListener("sandpack-error", handleSandpackError);
        window.addEventListener("sandpack-error-dismiss", handleDismiss);
        return () => {
            window.removeEventListener("sandpack-error", handleSandpackError);
            window.removeEventListener("sandpack-error-dismiss", handleDismiss);
        };
    }, []);

    // ------------------------------------------------------------
    // Fix Error handler — sends targeted single-file fix request
    // ------------------------------------------------------------
    const handleFixError = useCallback((error: string) => {
        setPreviewError(null);
        const prompt = `The preview has a runtime/build error. Fix ONLY the file(s) causing this error — do NOT rewrite all files. Return only the fixed file(s) in the standard XML format.

Error:
${error}`;
        handleSendMessageRef.current(prompt, undefined, ["codebase"]);
    }, []);

    // ------------------------------------------------------------
    // Auto-save: debounced manual edits → new version
    // ------------------------------------------------------------

    /** Ref tracking the debounce timer for auto-save */
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Ref tracking the max-wait timer (force save after 30s of continuous typing) */
    const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Ref to the last saved files snapshot (for change detection) */
    const lastSavedFilesRef = useRef<Record<string, string>>({});

    /** Whether this is a user-initiated edit (not an AI update) */
    const isManualEditRef = useRef(false);

    useEffect(() => {
        const loadProject = async () => {
            try {
                const [
                    projectResponse,
                    filesResponse,
                    chatResponse,
                    versionsResponse,
                    creditsResponse,
                ] = await Promise.all([
                    client.projects.get(projectId),
                    client.projects.getFiles(projectId),
                    client.chats.getHistory(projectId),
                    client.versions.list(projectId),
                    client.credits.get(),
                ]);

                setProject(projectResponse.project);
                // Validate model exists in registry, fallback to default if not
                const projectModel = projectResponse.project.model;
                const validModel = getModelById(projectModel) ? projectModel : DEFAULT_MODEL_ID;
                setSelectedModelId(validModel);
                setCreditsRemaining(
                    creditsResponse.isUnlimited ? -1 : creditsResponse.remaining
                );
                setCreditsTotal(creditsResponse.total);
                setUserPlan(creditsResponse.plan);
                const filesRecord = filesToRecord(filesResponse.files);
                setFiles(filesRecord);
                currentFilesRef.current = filesRecord;

                setMessages(chatResponse.messages);
                setVersions(versionsResponse.versions);

                const filePaths = filesResponse.files.map((f) => f.path);

                if (filePaths.includes("src/App.tsx")) {
                    setActiveFile("src/App.tsx");
                } else if (filePaths.length > 0) {
                    setActiveFile(filePaths[0]);
                }

                try {
                    const storageKey = `pending_prompt_${projectId}`;
                    const pending = sessionStorage.getItem(storageKey);

                    if (pending) {
                        pendingPromptRef.current = pending;
                        sessionStorage.removeItem(storageKey);
                    }
                } catch {
                    // ignore storage errors
                }

            } catch (error) {
                console.error("Load project error:", error);
                router.push("/dashboard")
            } finally {
                setIsLoading(false);
                setIsLoadingVersions(false);
            }
        };

        loadProject();
    }, [projectId, getToken, router]);

    if (isLoading) return <EditorLayoutSkeleton />


    return (
        <EditorLayout
            projectId={projectId}
            projectName={project?.name ?? ""}
            files={files}
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onFilesChange={(updatedFiles) => {
                setFiles(updatedFiles);
            }}
            activeFile={activeFile}
            onActiveFileChange={setActiveFile}
            previewPanel={
                                <PreviewPanel
                                    files={files}
                                    isStreaming={isStreaming}
                                    previewError={previewError}
                                    onFixError={handleFixError}
                                    tasks={currentTasks}
                                />
                            }
            codeEditorPanel={
                <CodeEditor
                    files={files}
                    activeFile={activeFile}
                    onActiveFileChange={setActiveFile}
                    onFileChange={(path, content) => {
                        setFiles((prev) => ({ ...prev, [path]: content }));
                    }}
                />
            }
            viewingVersion={viewingVersion}
            onBackToCurrent={() => setViewingVersion(null)}
            onRestoreViewing={() => { }}
            creditsRemaining={creditsRemaining}
            creditsTotal={creditsTotal}
            isCreditsExhausted={isCreditsExhausted}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            userPlan={userPlan}
            onRename={(newName) => {
                // Will be implemented
            }}
            onDelete={() => {
                // Will be implemented
            }}
        />
    );
};

export function EditorLayoutSkeleton() {
    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            {/* Header skeleton */}
            <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-7 rounded-full" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-44 hidden sm:block" />
                    </div>
                </div>

                <div className="mx-auto">
                    <Skeleton className="h-8 w-48 rounded-full" />
                </div>

                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-16 rounded-md hidden sm:block" />
                    <Skeleton className="size-7 rounded-full" />
                </div>
            </div>

            {/* Panel body skeleton — desktop */}
            <div className="hidden md:flex flex-1 overflow-hidden">
                <div className="flex w-[30%] shrink-0 flex-col border-r border-border">
                    <div className="flex-1 space-y-4 p-4">
                        <Skeleton className="ml-auto h-16 w-3/4 rounded-2xl" />
                        <Skeleton className="h-24 w-3/4 rounded-2xl" />
                        <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                    </div>

                    <div className="border-t border-border p-3">
                        <Skeleton className="h-12 rounded-xl" />
                    </div>
                </div>

                <div className="flex flex-1 flex-col">
                    <div className="flex-1 p-4">
                        <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Panel body skeleton — mobile */}
            <div className="flex md:hidden flex-1 flex-col p-4">
                <Skeleton className="h-full w-full rounded-lg" />
            </div>
        </div>
    );
}

export default EditorPage;