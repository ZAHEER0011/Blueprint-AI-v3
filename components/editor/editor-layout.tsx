"use client"
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import React, { useCallback, useEffect, useState } from "react";
import { ChatMessage, ImageAttachment } from "@/types/chat";
import { EditorHeader } from "./editor-header";
import { PanelErrorBoundary } from "./panel-error-boundary";

export interface EditorLayoutProps {
    projectId: string;
    projectName: string;
    files: Record<string, string>;
    messages: ChatMessage[];
    isStreaming: boolean;

    onSendMessage: (message: string, images?: ImageAttachment[], selectedFiles?: string[]) => void;
    onFilesChange: (files: Record<string, string>) => void;

    activeFile: string;
    onActiveFileChange: (filePath: string) => void;

    previewPanel: React.ReactNode;
    codeEditorPanel: React.ReactNode;
    historyPanel?: React.ReactNode;

    viewingVersion?: number | null;
    onBackToCurrent?: () => void;
    onRestoreViewing?: () => void;

    creditsRemaining?: number;
    creditsTotal?: number;
    isCreditsExhausted?: boolean;

    selectedModelId: string;
    onModelChange: (modelId: string) => void;

    userPlan: "free" | "pro";

    onRename: (newName: string) => void;
    onDelete: () => void;
}

/** Minimum and maximum width for the chat panel in percentage */
const MIN_CHAT_PERCENT = 20;
const MAX_CHAT_PERCENT = 50;
const DEFAULT_CHAT_PERCENT = 30;

/** Absolute pixel minimum for the chat panel */
const MIN_CHAT_PX = 320;


export const EditorLayout = ({
    projectId,
    projectName,
    files,
    messages,
    isStreaming,
    onSendMessage,
    previewPanel,
    codeEditorPanel,
    historyPanel,
    viewingVersion,
    onBackToCurrent,
    onRestoreViewing,
    creditsRemaining,
    creditsTotal,
    isCreditsExhausted,
    selectedModelId,
    onModelChange,
    userPlan,
    onRename,
    onDelete,
}: EditorLayoutProps) => {
    const [activeTab, setActiveTab] = useState<"preview" | "code" | "history">("preview");
    const [mobilePanel, setMobilePanel] = useState<"chat" | "content">("content");
    const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "phone">("desktop");
    const [isDragging, setIsDragging] = useState(false);
    const [chatWidthPercent, setChatWidthPercent] = useState(DEFAULT_CHAT_PERCENT);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width;
                if (containerWidth <= 0) return;

                const minPercent =
                    (MIN_CHAT_PX / containerWidth) * 100;

                setChatWidthPercent((prev) =>
                    prev < minPercent
                        ? Math.min(minPercent, MAX_CHAT_PERCENT)
                        : prev
                );
            }
        });

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setIsDragging(true)
    }, []
    )

    const handlePointerUp = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setIsDragging(false);
        },
        []
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!isDragging || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();

            const newPercent =
                ((event.clientX - containerRect.left) / containerRect.width) * 100;

            // Compute the pixel-based minimum as a percentage of the container
            const minPercentFromPx =
                (MIN_CHAT_PX / containerRect.width) * 100;

            // Clamp: respect both the percentage min and the pixel min
            const effectiveMin = Math.max(
                MIN_CHAT_PERCENT,
                minPercentFromPx
            );

            const clamped = Math.min(
                MAX_CHAT_PERCENT,
                Math.max(effectiveMin, newPercent)
            );

            setChatWidthPercent(clamped);
        },
        [isDragging]
    );


    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <EditorHeader
                projectName={projectName}
                files={files}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                mobilePanel={mobilePanel}
                onMobilePanelChange={setMobilePanel}
                projectId={projectId}
                userPlan={userPlan}
                creditsRemaining={creditsRemaining}
                creditsTotal={creditsTotal}
                onRename={onRename}
                onDelete={onDelete}
                deviceMode={deviceMode}
                onDeviceModeChange={setDeviceMode}
            />

            <div
                className={cn(
                    "hidden md:flex flex-1 overflow-hidden",
                    isDragging && "select-none"
                )}
                ref={containerRef}
            >
                {/* Chat Panel - Sidebar */}
                <div
                    className="shrink-0 overflow-hidden"
                    style={{
                        width: `${chatWidthPercent}%`,
                        minWidth: MIN_CHAT_PX,
                    }}
                >
                    <ChatPanel
                        messages={messages}
                        isStreaming={isStreaming}
                        onSendMessage={onSendMessage}
                        creditsRemaining={creditsRemaining}
                        isCreditsExhausted={isCreditsExhausted}
                        selectedModelId={selectedModelId}
                        onModelChange={onModelChange}
                        userPlan={userPlan}
                        files={files}
                    />
                </div>

                {/* Resize Handle */}
                {/* Drag Handle */}
                <div
                    className={cn(
                        "panel-resize-handle shrink-0",
                        isDragging && "panel-resize-handle--active"
                    )}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerMove={handlePointerMove}
                />

                {/* Content Area */}
                <main className="flex-1 overflow-hidden relative bg-muted/20 flex flex-col">
                    {/* Resizing Overlay - prevents iframes from stealing focus during drag */}
                    {isDragging && (
                        <div className="absolute inset-0 z-50 bg-transparent cursor-col-resize" />
                    )}

                    {/* Preview Panel */}
                    {activeTab === "preview" && (
                        <>
                            <div className="flex h-10 shrink-0 items-center border-b border-border px-4 bg-muted/30">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Preview Panel
                                </span>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-200",
                                        deviceMode !== "desktop"
                                            ? "flex items-start justify-center overflow-auto bg-muted/30 p-6"
                                            : ""
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "h-full max-w-full transition-all duration-200",
                                            deviceMode !== "desktop"
                                                ? "shrink-0 overflow-hidden rounded-lg border border-border shadow-lg"
                                                : "w-full"
                                        )}
                                        style={
                                            deviceMode !== "desktop"
                                                ? { width: deviceMode === "tablet" ? 768 : 375 }
                                                : undefined
                                        }
                                    >
                                        <PanelErrorBoundary name="Preview">
                                            {previewPanel}
                                        </PanelErrorBoundary>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Code Editor Panel */}
                    {activeTab === "code" && (
                        <>
                            <div className="flex h-10 shrink-0 items-center border-b border-border px-4 bg-muted/30">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Code Editor
                                </span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <PanelErrorBoundary name="Code Editor">
                                    {codeEditorPanel}
                                </PanelErrorBoundary>
                            </div>
                        </>
                    )}

                    {/* Version History Panel */}
                    {activeTab === "history" && (
                        <>
                            <div className="flex h-10 shrink-0 items-center border-b border-border px-4 bg-muted/30">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Version History
                                </span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <PanelErrorBoundary name="History">
                                    {historyPanel || (
                                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <p className="text-sm italic">No version history yet.</p>
                                        </div>
                                    )}
                                </PanelErrorBoundary>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};
