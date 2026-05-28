"use client"

import { getModelById } from "@/lib/models"
import { ChatMessage } from "@/types/chat"
import { Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export interface MessageBubbleProps {
    message: ChatMessage
    isStreaming?: boolean
    isAutoHealInProgress?: boolean
}

export function formatModelName(modelId: string): string {
    const modelInfo = getModelById(modelId);
    if (modelInfo) return modelInfo.name;
    if (modelId.includes("claude")) return "Claude";
    if (modelId.includes("gemini")) return "Gemini";
    if (modelId.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (modelId.includes("gpt-4o")) return "GPT-4o";
    if (modelId.includes("deepseek")) return "DeepSeek";
    return modelId;
}

export const AUTO_HEAL_PREFIX = "The app has a build/runtime error";

export function extractAttemptNumber(content: string): number {
    const match = content.match(/\(attempt (\d+)\/\d+\)/);
    return match ? parseInt(match[1], 10) : 1;
}

export function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function parseTasks(content: string) {
    const taskRegex = /<task status="([^"]+)">([\s\S]*?)<\/task>/g;
    const tasks: Array<{ status: string; description: string }> = [];
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
        tasks.push({ status: match[1], description: match[2].trim() });
    }
    return tasks;
}

/**
 * Extracts explanation text from AI response by removing XML tags
 */
function extractExplanationText(content: string): string {
    // Remove files blocks
    let cleaned = content.replace(/<files>[\s\S]*?<\/files>/g, "");
    // Remove task blocks
    cleaned = cleaned.replace(/<task[^>]*>[\s\S]*?<\/task>/g, "");
    // Remove other XML tags
    cleaned = cleaned.replace(/<[^>]+>/g, "");
    // Trim whitespace
    return cleaned.trim();
}

export function MessageBubble({
    message,
    isStreaming,
    isAutoHealInProgress,
}: MessageBubbleProps) {
    const isUser = message.role === "user";
    const isAutoHeal = isUser && message.content.startsWith(AUTO_HEAL_PREFIX);
    const tasks = parseTasks(message.content);
    const explanationText = extractExplanationText(message.content);

    if (isAutoHeal) {
        return (
            <div className="flex w-full justify-center my-2">
                <Badge variant="destructive" className="animate-pulse">
                    <AlertCircle className="size-3 mr-1" />
                    AI detected an error... Attempting auto-heal (Attempt {extractAttemptNumber(message.content)})
                </Badge>
            </div>
        );
    }

    if (isUser) {
        return (
            <div className="flex w-full justify-end mb-4">
                <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm">
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full justify-start mb-4 flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-secondary flex items-center justify-center border border-border">
                    <span className="text-xs font-semibold">AI</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                        {message.model ? formatModelName(message.model) : "AI Assistant"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
                </div>
            </div>

            <Card className="max-w-[90%] md:max-w-[80%] p-4 bg-card text-card-foreground shadow-sm ml-10 flex flex-col gap-3">
                {/* Task Progress Section */}
                {tasks.length > 0 && (
                    <div className="flex flex-col gap-2 border-b border-border pb-3 mb-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-primary">Task Progress</span>
                            {isStreaming && tasks.some(t => t.status === "in_progress") && (
                                <Loader2 className="size-4 animate-spin text-primary" />
                            )}
                        </div>
                        {tasks.map((t, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm transition-all duration-300">
                                {t.status === "completed" ? (
                                    <CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
                                ) : t.status === "in_progress" || (isStreaming && i === tasks.length - 1) ? (
                                    <Loader2 className="size-4 text-yellow-500 mt-0.5 shrink-0 animate-spin" />
                                ) : (
                                    <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                                )}
                                <span className={`${t.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                                    {t.description}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content/Explanation Section */}
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                    {isStreaming && !explanationText && !message.content ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Generating code...
                        </div>
                    ) : explanationText ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {explanationText}
                        </ReactMarkdown>
                    ) : message.content ? (
                        <div className="text-muted-foreground">
                            AI generation completed. Files have been applied to the editor.
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Processing response...
                        </div>
                    )}
                </div>

                {!isStreaming && /^Error\s*(\(|:)/i.test(message.content.trim()) && (
                    <Badge variant="destructive" className="w-fit mt-2">Error during generation</Badge>
                )}
            </Card>
        </div>
    );
}