import { useCallback, useEffect, useRef, useState } from "react";
import { ImageAttachment } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SendHorizontal, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

export interface ChatInputProps {
    onSend: (message: string, images?: ImageAttachment[], selectedFiles?: string[]) => void;
    isStreaming: boolean;
    creditsRemaining?: number;
    isCreditsExhausted?: boolean;
    supportsVision?: boolean;
    files: Record<string, string>;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function ChatInput({
    onSend,
    isStreaming,
    creditsRemaining,
    isCreditsExhausted = false,
    supportsVision = false,
    files = {},
}: ChatInputProps) {
    const [value, setValue] = useState("");
    const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    
    // Autocomplete suggestions states
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [triggerIdx, setTriggerIdx] = useState(-1);
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const isDisabled = isStreaming || isCreditsExhausted;
    const hasContent = value.trim().length > 0 || attachedImages.length > 0 || selectedFiles.length > 0;

    // Sync selected files when files list changes (in case a file is deleted)
    useEffect(() => {
        setSelectedFiles((prev) => {
            const availableFiles = Object.keys(files || {});
            return prev.filter((f) => f === "codebase" || availableFiles.includes(f));
        });
    }, [files]);

    // Outside click handler for suggestions popup
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    // Filter files and codebase options based on search query
    const allFilePaths = Object.keys(files || {});
    const suggestionsList = ["codebase", ...allFilePaths];
    const filteredFiles = suggestionsList.filter((f) => {
        if (!searchQuery) return true;
        return f.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleSelectFile = useCallback((file: string) => {
        setSelectedFiles((prev) => {
            if (file === "codebase") {
                return ["codebase"];
            }
            const filtered = prev.filter((f) => f !== "codebase");
            if (filtered.includes(file)) return filtered;
            return [...filtered, file];
        });

        // Replace trigger text #query in value
        const cursor = textareaRef.current?.selectionStart ?? 0;
        const textBeforeTrigger = value.slice(0, triggerIdx);
        const textAfterTrigger = value.slice(cursor);
        
        setValue(textBeforeTrigger + textAfterTrigger);
        setShowSuggestions(false);

        setTimeout(() => {
            textareaRef.current?.focus();
            if (textareaRef.current) {
                textareaRef.current.selectionStart = triggerIdx;
                textareaRef.current.selectionEnd = triggerIdx;
            }
        }, 10);
    }, [value, triggerIdx]);

    const handleRemoveFile = useCallback((file: string) => {
        setSelectedFiles((prev) => prev.filter((f) => f !== file));
    }, []);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setValue(val);

        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const lastHashIdx = textBeforeCursor.lastIndexOf("#");

        if (lastHashIdx !== -1) {
            const query = textBeforeCursor.slice(lastHashIdx + 1);
            // Verify there are no spaces or newlines in the query
            const hasWhitespace = /\s/.test(query);

            if (!hasWhitespace) {
                setShowSuggestions(true);
                setSearchQuery(query);
                setTriggerIdx(lastHashIdx);
                setActiveSuggestionIdx(0);
                return;
            }
        }

        setShowSuggestions(false);
    };

    // Autofocus
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }, [value]);

    // -------- FILE PROCESSING --------
    const processFile = useCallback(
        async (file: File): Promise<ImageAttachment | null> => {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                toast.error("Only PNG, JPEG, GIF, and WebP images are supported.");
                return null;
            }

            if (file.size > MAX_IMAGE_SIZE) {
                toast.error("Image must be under 4MB.");
                return null;
            }

            return new Promise((resolve) => {
                const reader = new FileReader();

                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    const base64 = dataUrl.split(",")[1];

                    resolve({
                        base64,
                        mediaType: file.type,
                        name: file.name,
                    });
                };

                reader.onerror = () => {
                    toast.error("Failed to read image file.");
                    resolve(null);
                };

                reader.readAsDataURL(file);
            });
        },
        []
    );

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const remaining = MAX_IMAGES - attachedImages.length;
            const filesToProcess = Array.from(files).slice(0, remaining);

            if (Array.from(files).length > remaining) {
                toast.error(`Maximum ${MAX_IMAGES} images per message.`);
            }

            const results = await Promise.all(filesToProcess.map(processFile));
            const valid = results.filter(Boolean) as ImageAttachment[];

            if (valid.length > 0) {
                setAttachedImages((prev) => [...prev, ...valid]);
            }
        },
        [attachedImages.length, processFile]
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                handleFiles(e.target.files);
                e.target.value = "";
            }
        },
        [handleFiles]
    );

    const removeImage = useCallback((index: number) => {
        setAttachedImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // -------- SEND --------
    const handleSend = useCallback(() => {
        const trimmed = value.trim();

        if ((!trimmed && attachedImages.length === 0 && selectedFiles.length === 0) || isCreditsExhausted) return;

        onSend(
            trimmed || "Describe this image",
            attachedImages.length > 0 ? attachedImages : undefined,
            selectedFiles.length > 0 ? selectedFiles : undefined
        );

        setValue("");
        setAttachedImages([]);
        setSelectedFiles([]);
    }, [value, attachedImages, selectedFiles, isCreditsExhausted, onSend]);

    // -------- KEYBOARD --------
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showSuggestions && filteredFiles.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSuggestionIdx((prev) => (prev + 1) % filteredFiles.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveSuggestionIdx((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                handleSelectFile(filteredFiles[activeSuggestionIdx]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // -------- DROP --------
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            if (!supportsVision) return;

            const imageFiles: File[] = [];

            for (const file of Array.from(e.dataTransfer.files)) {
                if (file.type.startsWith("image/")) {
                    imageFiles.push(file);
                }
            }

            if (imageFiles.length > 0) {
                handleFiles(imageFiles);
            }
        },
        [supportsVision, handleFiles]
    );

    // -------- PASTE --------
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            if (!supportsVision) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            const imageFiles: File[] = [];

            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                }
            }

            if (imageFiles.length > 0) {
                e.preventDefault();
                handleFiles(imageFiles);
            }
        },
        [supportsVision, handleFiles]
    );

    return (
        <div
            className="px-3 pb-3 pt-1.5 relative"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            {/* SUGGESTIONS POPUP */}
            {showSuggestions && filteredFiles.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute bottom-full left-3 right-3 mb-2 z-50 max-h-[220px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
                >
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                        Files suggestion
                    </div>
                    {filteredFiles.map((file, idx) => (
                        <button
                            key={file}
                            onClick={() => handleSelectFile(file)}
                            className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors",
                                idx === activeSuggestionIdx
                                    ? "bg-accent text-accent-foreground"
                                    : "text-popover-foreground hover:bg-accent/50 hover:text-accent-foreground"
                            )}
                        >
                            <span className="truncate">
                                {file === "codebase" ? "#codebase (entire project)" : file}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <div
                className={cn(
                    "flex flex-col rounded-xl border border-border/50 bg-background transition-colors",
                    "focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10"
                )}
            >
                {/* SELECTED FILES */}
                {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                        {selectedFiles.map((file) => (
                            <div
                                key={file}
                                className={cn(
                                    "flex items-center gap-1 rounded bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground border border-border/40",
                                    file === "codebase" && "bg-primary/10 text-primary border-primary/20"
                                )}
                            >
                                <span className="max-w-[150px] truncate">
                                    {file === "codebase" ? "#codebase" : file}
                                </span>
                                <button
                                    onClick={() => handleRemoveFile(file)}
                                    className="rounded-full hover:bg-muted p-0.5 transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* IMAGE PREVIEW */}
                {attachedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-3 pt-2">
                        {attachedImages.map((img, index) => (
                            <div
                                key={index}
                                className="group relative size-14 overflow-hidden rounded-lg border border-border/50"
                            >
                                <img
                                    src={`data:${img.mediaType};base64,${img.base64}`}
                                    alt={img.name || "Attached image"}
                                    className="size-full object-cover"
                                />

                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition group-hover:opacity-100"
                                >
                                    <X className="size-2.5" />
                                </button>
                            </div>
                        ))}

                        <span className="text-[11px] font-medium text-muted-foreground/60">
                            {attachedImages.length}/{MAX_IMAGES}
                        </span>
                    </div>
                )}

                {/* INPUT ROW */}
                <div className="flex items-end gap-2 px-3 py-2">
                    {supportsVision && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isDisabled || attachedImages.length >= MAX_IMAGES}
                        >
                            <Paperclip className="size-3.5" />
                        </Button>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={
                            isCreditsExhausted
                                ? "You've run out of credits"
                                : isStreaming
                                    ? "AI is generating..."
                                    : "Describe what you want to build..."
                        }
                        disabled={isDisabled}
                        rows={1}
                        className={cn(
                            "flex-1 resize-none bg-transparent text-sm outline-none",
                            "min-h-[24px] max-h-[200px]",
                            isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                    />

                    <Button
                        size="icon-xs"
                        onClick={handleSend}
                        disabled={!hasContent || isDisabled}
                    >
                        <SendHorizontal className="size-3.5" />
                    </Button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                className="hidden"
                onChange={handleFileSelect}
            />
        </div>
    );
}