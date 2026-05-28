/**
 * worker/src/routes/chat.ts
 *
 * Chat history endpoints for the editor chat panel.
 * Chat sessions are stored in KV as `chat:{projectId}`.
 *
 * Endpoints:
 *   GET  /api/chat/:projectId  - Load chat history for a project
 *   POST /api/chat/:projectId  - Save/update chat history for a project
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Env, AppVariables } from "../types";
import { Project, ProjectFile, Version } from "../types/project";
import { ChatMessage, ChatSession, ImageAttachment } from "../types/chat";
import { DEFAULT_MODEL, getModel, MODEL_REGISTRY } from "../ai/providers";
import { sanitizeChatMessage } from "../services/sanitize";
import { checkCredits, deductCredits } from "../services/credits";
import { buildSystemPrompt, prepareChatHistory } from "../ai/system-prompt";
import { ModelMessage, streamText } from "ai";
import { extractExplanation, extractTasks, mergeFiles, parseFilesFromResponse, parseStreamingFiles } from "../ai/file-parser";

const chatRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/chat/:projectId
 * Returns the chat history for a project.
 * Used by the editor page to restore chat messages on mount.
 */
chatRoutes.get("/:projectId", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("projectId");

    const project = await c.env.METADATA.get<Project>(
        `project:${projectId}`,
        "json"
    );

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 403);
    }

    const chatHistory = await c.env.METADATA.get<ChatSession>(
        `chat:${projectId}`,
        "json"
    );

    return c.json({
        messages: chatHistory?.messages ?? [],
    });
});

/**
 * POST /api/chat/:projectId
 * Streams AI response and saves chat history.
 * This is the main endpoint for sending messages to the AI.
 */
chatRoutes.post("/:projectId", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("projectId");

    const body = await c.req.json<{
        prompt: string;
        model?: string;
        images?: ImageAttachment[];
        selectedFiles?: string[];
    }>();

    const userMessage = sanitizeChatMessage(body.prompt || "");
    if (!userMessage) {
        return c.json(
            { error: "Message cannot be empty", code: "VALIDATION_ERROR" },
            400
        );
    }

    const images = body.images || [];

    const project = await c.env.METADATA.get<Project>(
        `project:${projectId}`,
        "json"
    );

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 403);
    }

    // Determine model and validate registry
    let modelId = body.model || project.model || DEFAULT_MODEL;
    
    console.log(`[CHAT] Final modelId: "${modelId}"`);
    console.log(`[CHAT] Available Registry Keys: ${Object.keys(MODEL_REGISTRY).join(", ")}`);

    let modelConfig = MODEL_REGISTRY[modelId];

    if (!modelConfig) {
        console.warn(`[CHAT] Invalid model "${modelId}" requested, falling back to ${DEFAULT_MODEL}`);
        modelId = DEFAULT_MODEL;
        modelConfig = MODEL_REGISTRY[modelId];
    }

    if (!modelConfig) {
        return c.json({ 
            error: "Selected AI model is unavailable. Please choose a different model.", 
            code: "MODEL_NOT_FOUND",
            requested: modelId,
            available: Object.keys(MODEL_REGISTRY)
        }, 404);
    }

    if (images.length > 5) {
        return c.json(
            { error: "Maximum 5 images allowed", code: "VALIDATION_ERROR" },
            400
        );
    }

    for (const img of images) {
        const sizeInBytes = (img.base64.length * 3) / 4;
        if (sizeInBytes > 4 * 1024 * 1024) {
            return c.json(
                { error: "Each image must be under 4MB", code: "VALIDATION_ERROR" },
                400
            );
        }
    }

    // Credit check
    const creditCheck = await checkCredits(
        userId,
        modelConfig.creditCost,
        c.env
    );

    if (modelConfig.tier === "premium" && creditCheck.credits.plan === "free") {
        return c.json(
            {
                error: "This model is only available for Pro users",
                code: "PREMIUM_MODEL_LOCKED",
                plan: creditCheck.credits.plan,
            },
            403
        );
    }

    if (!creditCheck.allowed) {
        return c.json(
            {
                error: "You have exhausted your credits",
                code: "CREDITS_EXHAUSTED",
                remaining: creditCheck.credits.remaining,
                required: modelConfig.creditCost,
            },
            402
        );
    }

    // Load existing files
    const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
    const versionObject = await c.env.FILES.get(versionKey);

    let existingFiles: ProjectFile[] = [];

    if (versionObject) {
        const versionData = (await versionObject.json()) as Version;
        existingFiles = versionData.files || [];
    }

    // Chat history
    const chatSession = await c.env.METADATA.get<ChatSession>(
        `chat:${projectId}`,
        "json"
    );

    const chatHistory = chatSession?.messages || [];

    const systemPrompt = buildSystemPrompt(existingFiles, body.selectedFiles);

    const rawMessages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

    for (const msg of chatHistory) {
        if (msg.role === "system") continue;
        rawMessages.push({ role: msg.role, content: msg.content });
    }

    const trimmedHistory = prepareChatHistory(rawMessages);

    const sdkMessages: ModelMessage[] = trimmedHistory.map((msg) =>
        msg.role === "user"
            ? { role: "user" as const, content: msg.content }
            : { role: "assistant" as const, content: msg.content }
    );

    // Add current message
    if (images.length > 0 && modelConfig.supportsVision) {
        sdkMessages.push({
            role: "user" as const,
            content: [
                { type: "text" as const, text: userMessage },
                ...images.map((img) => ({
                    type: "image" as const,
                    image: img.base64,
                    mimeType: img.mediaType,
                })),
            ],
        });
    } else {
        sdkMessages.push({
            role: "user" as const,
            content: userMessage,
        });
    }

    // Save user message immediately to the database
    const newUserMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        images: images.length > 0 ? images : undefined,
        selectedFiles: body.selectedFiles,
    };

    const initialChatSession: ChatSession = {
        projectId,
        messages: [...chatHistory, newUserMessage],
        createdAt: chatSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await c.env.METADATA.put(
        `chat:${projectId}`,
        JSON.stringify(initialChatSession)
    );

    // STREAM RESPONSE
    return streamSSE(c, async (stream) => {
        let fullResponse = "";
        let eventId = 0;
        let lastChunkTime = Date.now();

        // Helper to save assistant error message to database and stream error to client
        const saveAndSendError = async (message: string, code: string) => {
            try {
                // Send SSE error event
                await stream.writeSSE({
                    event: "error",
                    data: JSON.stringify({ message, code }),
                    id: String(eventId++),
                });
            } catch (sseError) {
                console.error("[Chat] Failed to write SSE error:", sseError);
            }

            try {
                // Save to chat history
                const errorMsg: ChatMessage = {
                    id: `msg-${Date.now()}-assistant-error`,
                    role: "assistant",
                    content: `Error: ${message}`,
                    timestamp: new Date().toISOString(),
                    model: modelId,
                };
                const currentSession = await c.env.METADATA.get<ChatSession>(
                    `chat:${projectId}`,
                    "json"
                );
                if (currentSession) {
                    const updatedChatSession: ChatSession = {
                        projectId,
                        messages: [...currentSession.messages, errorMsg],
                        createdAt: currentSession.createdAt,
                        updatedAt: new Date().toISOString(),
                    };
                    await c.env.METADATA.put(
                        `chat:${projectId}`,
                        JSON.stringify(updatedChatSession)
                    );
                }
            } catch (dbError) {
                console.error("[Chat] Failed to save error to chat history:", dbError);
            }
        };

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
            const elapsed = Date.now() - lastChunkTime;
            if (elapsed > 5000) {
                // Send ping every 5 seconds of inactivity
                stream.writeSSE({
                    event: "ping",
                    data: JSON.stringify({ time: Date.now() }),
                    id: String(eventId++),
                }).catch(() => {});
            }
        }, 5000);

        try {
            // Initialize model and verify it works
            let model;
            try {
                model = getModel(modelId, c.env);
                console.log("[Chat] Model initialized successfully:", modelId);
            } catch (modelError) {
                const errorMsg = modelError instanceof Error ? modelError.message : "Unknown error";
                console.error("[Chat] Model initialization failed:", errorMsg);
                await saveAndSendError(`AI model initialization failed: ${errorMsg}`, "MODEL_INIT_FAILED");
                return;
            }

            // Send initial heartbeat to confirm connection
            await stream.writeSSE({
                event: "connected",
                data: JSON.stringify({ message: "Stream started" }),
                id: String(eventId++),
            });

            const result = streamText({
                model,
                system: systemPrompt,
                messages: sdkMessages,
                maxOutputTokens: modelConfig.maxOutputTokens,
                maxRetries: 0, // Don't retry — quota errors should fail fast, not triple API calls
                timeout: 600000, // 10 minutes timeout for slow/large generations
            });

            console.log("[Chat] Stream initialized, waiting for chunks...");

            let chunkCount = 0;
            let streamError: { message: string; code: string } | null = null;
            let lastSentTaskKey = "";
            const streamStartTime = Date.now();

            for await (const part of result.fullStream) {
                if (part.type === "text-delta") {
                    const chunk = part.text;
                    fullResponse += chunk;
                    lastChunkTime = Date.now();
                    chunkCount++;
                    
                    // Periodic debug log (every 20 chunks)
                    if (chunkCount % 20 === 0) {
                        console.log("[Chat] Chunk received, length:", chunk.length, "total chunks:", chunkCount);
                    }

                    await stream.writeSSE({
                        event: "chunk",
                        data: JSON.stringify({ text: chunk }),
                        id: String(eventId++),
                    });

                    // --- REAL-TIME UPDATES (Throttled) ---
                    // Every 5 chunks or 500ms, send task updates.
                    // Real-time file streaming is disabled to prevent sandpack rendering half-finished files.
                    if (chunkCount % 5 === 0) {
                        // Extract tasks
                        const tasks = extractTasks(fullResponse);
                        if (tasks.length > 0) {
                            const latestTask = tasks[tasks.length - 1];
                            const taskKey = `${latestTask.status}:${latestTask.description}`;

                            if (taskKey !== lastSentTaskKey) {
                                lastSentTaskKey = taskKey;
                                await stream.writeSSE({
                                    event: "task",
                                    data: JSON.stringify(latestTask),
                                    id: String(eventId++),
                                });
                            }
                        }
                    }
                }

                if (part.type === "error") {
                    const rawStreamError =
                        part.error instanceof Error
                            ? part.error.message
                            : JSON.stringify(part.error);

                    console.error("[Chat] AI provider stream error:", rawStreamError);

                    let message = "Failed to generate code. Please try again.";
                    let code = "GENERATION_FAILED";

                    if (
                        rawStreamError.includes("404") ||
                        rawStreamError.includes("not found") ||
                        rawStreamError.includes("NOT_FOUND")
                    ) {
                        message =
                            "Selected AI model is unavailable. Please choose a different model.";
                        code = "MODEL_NOT_FOUND";
                    } else if (
                        rawStreamError.includes("429") ||
                        rawStreamError.toLowerCase().includes("rate limit") ||
                        rawStreamError.toLowerCase().includes("quota")
                    ) {
                        message = "AI provider quota/rate limit reached. Please try again later.";
                        code = "RATE_LIMITED";
                    } else if (
                        rawStreamError.includes("401") ||
                        rawStreamError.toLowerCase().includes("api key")
                    ) {
                        message = "AI service authentication failed. Check API key configuration.";
                        code = "AUTH_FAILED";
                    }

                    streamError = { message, code };
                    break;
                }
            }

            console.log("[Chat] Stream complete, total chunks:", chunkCount, "response length:", fullResponse.length);

            if (streamError) {
                await saveAndSendError(streamError.message, streamError.code);
                return;
            }

            // Check if we got any response
            if (chunkCount === 0 || fullResponse.trim().length === 0) {
                console.error("[Chat] No response received from AI model");
                await saveAndSendError("AI model returned empty response. Please try again.", "EMPTY_RESPONSE");
                return;
            }

            // Parse files
            console.log("[Chat] Full AI response length:", fullResponse.length);
            const parsedFiles = parseFilesFromResponse(fullResponse);
            console.log("[Chat] Parsed files:", parsedFiles.length, parsedFiles.map(f => f.path));

            if (parsedFiles.length === 0) {
                await saveAndSendError("AI response did not include valid <files> XML output. Please retry.", "INVALID_AI_FORMAT");
                return;
            }

            const changedFilePaths = parsedFiles.map((f) => f.path);

            const mergedFiles =
                parsedFiles.length > 0
                    ? mergeFiles(existingFiles, parsedFiles)
                    : existingFiles;

            let newVersionNumber = project.currentVersion;

            if (parsedFiles.length > 0) {
                newVersionNumber = project.currentVersion + 1;

                const newVersion: Version = {
                    versionNumber: newVersionNumber,
                    prompt: userMessage,
                    model: modelId,
                    files: mergedFiles,
                    changedFiles: changedFilePaths,
                    type: "ai",
                    createdAt: new Date().toISOString(),
                    fileCount: mergedFiles.length,
                };

                await c.env.FILES.put(
                    `${projectId}/v${newVersionNumber}/files.json`,
                    JSON.stringify(newVersion)
                );

                project.currentVersion = newVersionNumber;
                project.updatedAt = new Date().toISOString();

                await c.env.METADATA.put(
                    `project:${projectId}`,
                    JSON.stringify(project)
                );
            }

            // Deduct credits
            const updatedCredits = await deductCredits(
                userId,
                modelConfig.creditCost,
                c.env
            );

            // Save chat
            const explanationText = extractExplanation(fullResponse);

            const newAssistantMessage: ChatMessage = {
                id: `msg-${Date.now()}-assistant`,
                role: "assistant",
                content: explanationText,
                timestamp: new Date().toISOString(),
                versionNumber:
                    parsedFiles.length > 0 ? newVersionNumber : undefined,
                model: modelId,
                changedFiles:
                    parsedFiles.length > 0 ? changedFilePaths : undefined,
            };

            const currentSession = await c.env.METADATA.get<ChatSession>(
                `chat:${projectId}`,
                "json"
            );

            const updatedChatSession: ChatSession = {
                projectId,
                messages: [...(currentSession?.messages || []), newAssistantMessage],
                createdAt: currentSession?.createdAt || chatSession?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await c.env.METADATA.put(
                `chat:${projectId}`,
                JSON.stringify(updatedChatSession)
            );

            // Send files
            if (parsedFiles.length > 0) {
                await stream.writeSSE({
                    event: "files",
                    data: JSON.stringify({ files: mergedFiles }),
                    id: String(eventId++),
                });
            }

            // Done event
            await stream.writeSSE({
                event: "done",
                data: JSON.stringify({
                    versionId: `v${newVersionNumber}`,
                    model: modelId,
                    changedFiles: changedFilePaths,
                    creditsRemaining: updatedCredits.remaining,
                    explanation: explanationText,
                }),
                id: String(eventId++),
            });
        } catch (error) {
            const rawError =
                error instanceof Error ? error.message : "Unknown error occurred";

            // Log full error details for debugging
            console.error("[Chat] Stream error:", rawError);
            console.error("[Chat] Full error object:", error);

            let userMessage = "Failed to generate code. Please try again.";
            let errorCode = "GENERATION_FAILED";

            if (rawError.includes("429") || rawError.includes("rate limit")) {
                userMessage = "Too many requests. Please wait and try again.";
                errorCode = "RATE_LIMITED";
            } else if (rawError.includes("401") || rawError.includes("api key")) {
                userMessage =
                    "AI service configuration error. Contact support.";
                errorCode = "AUTH_FAILED";
            } else if (rawError.includes("404") || rawError.includes("not found") || rawError.includes("NOT_FOUND")) {
                userMessage =
                    "AI model not found. Using fallback model.";
                errorCode = "MODEL_NOT_FOUND";
            } else if (
                rawError.includes("500") ||
                rawError.includes("503") ||
                rawError.includes("unavailable")
            ) {
                userMessage =
                    "AI service is temporarily unavailable. Try again.";
                errorCode = "SERVICE_UNAVAILABLE";
            } else if (
                rawError.includes("timeout") ||
                rawError.includes("TIMEOUT")
            ) {
                userMessage = "Generation timed out. Try a simpler request.";
                errorCode = "TIMEOUT";
            }

            await saveAndSendError(userMessage, errorCode);
        } finally {
            clearInterval(heartbeatInterval);
        }
    });
});
export { chatRoutes };
