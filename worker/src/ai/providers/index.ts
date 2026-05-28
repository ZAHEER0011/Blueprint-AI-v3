import { Env } from "../../types";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";

// Startup verification - this should log every time the worker restarts
console.log("[PROVIDERS] Loading providers module");

export interface ModelConfig {
    provider: "anthropic" | "openai" | "google" | "deepseek";
    displayName: string;
    apiModelId: string;
    creditCost: number;
    tier: "fast" | "premium";
    speed: "very-fast" | "fast" | "medium";
    quality: "good" | "high";
    description: string;
    supportsVision: boolean;
    maxOutputTokens: number;
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
    // --- Anthropic ---
    "claude-sonnet-4-5": {
        provider: "anthropic",
        displayName: "Claude Sonnet 4.5",
        apiModelId: "claude-sonnet-4-5-20250929",
        creditCost: 2,
        tier: "premium",
        speed: "medium",
        quality: "high",
        description:
            "Best code quality. Ideal for complex features and architecture.",
        supportsVision: true,
        maxOutputTokens: 64000,
    },
    "claude-haiku-3-5": {
        provider: "anthropic",
        displayName: "Claude Haiku 3.5",
        apiModelId: "claude-haiku-3-5-20251001",
        creditCost: 1,
        tier: "fast",
        speed: "fast",
        quality: "good",
        description:
            "Fast and capable. Great for quick iterations and simple changes.",
        supportsVision: true,
        maxOutputTokens: 64000,
    },

    // --- OpenAI ---
    "gpt-4o": {
        provider: "openai",
        displayName: "GPT-4o",
        apiModelId: "gpt-4o",
        creditCost: 2,
        tier: "premium",
        speed: "medium",
        quality: "high",
        description: "Versatile and reliable. Excellent for full-stack features.",
        supportsVision: true,
        maxOutputTokens: 16384,
    },
    "gpt-4o-mini": {
        provider: "openai",
        displayName: "GPT-4o Mini",
        apiModelId: "gpt-4o-mini",
        creditCost: 1,
        tier: "fast",
        speed: "fast",
        quality: "good",
        description: "Blazing fast and affordable. Perfect for small tweaks.",
        supportsVision: true,
        maxOutputTokens: 16384,
    },

    // --- Google ---
    "gemini-2.0-flash-legacy": {
        provider: "google",
        displayName: "Gemini 2.0 Flash",
        apiModelId: "gemini-2.5-flash",
        creditCost: 1,
        tier: "fast",
        speed: "very-fast",
        quality: "high",
        description:
            "Fast and efficient model.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-2.0-pro": {
        provider: "google",
        displayName: "Gemini 1.5 Pro",
        apiModelId: "gemini-1.5-pro-002",
        creditCost: 2,
        tier: "premium",
        speed: "fast",
        quality: "high",
        description:
            "Most capable model for complex applications. Better reasoning and larger context window.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-1.5-flash": {
        provider: "google",
        displayName: "Gemini 1.5 Flash",
        apiModelId: "gemini-1.5-flash-002",
        creditCost: 1,
        tier: "fast",
        speed: "very-fast",
        quality: "high",
        description:
            "Reliable fast model. Great for most code generation tasks.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-1.5-pro": {
        provider: "google",
        displayName: "Gemini 1.5 Pro",
        apiModelId: "gemini-1.5-pro-002",
        creditCost: 2,
        tier: "premium",
        speed: "fast",
        quality: "high",
        description:
            "Advanced model for complex coding tasks with excellent reasoning.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },

    // --- DeepSeek ---
    "deepseek-v3": {
        provider: "deepseek",
        displayName: "DeepSeek V3",
        apiModelId: "deepseek-chat",
        creditCost: 1,
        tier: "fast",
        speed: "fast",
        quality: "good",
        description: "Cost-effective and capable. Great for everyday coding tasks.",
        supportsVision: false,
        maxOutputTokens: 8000,
    },
    "deepseek-r1": {
        provider: "deepseek",
        displayName: "DeepSeek Reasoner",
        apiModelId: "deepseek-reasoner",
        creditCost: 1,
        tier: "fast",
        speed: "medium",
        quality: "high",
        description: "Reasoning model. Excellent for complex logic and debugging.",
        supportsVision: false,
        maxOutputTokens: 8000,
    },

    "gemini-2.0-flash": {
        provider: "google",
        displayName: "Gemini 2.0 Flash",
        apiModelId: "gemini-2.5-flash",
        creditCost: 1,
        tier: "fast",
        speed: "very-fast",
        quality: "high",
        description: "Alias for Gemini 2.0 Flash",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-3.1-flash": {
        provider: "google",
        displayName: "Gemini 3.1 Flash",
        apiModelId: "gemini-2.5-flash",
        creditCost: 1,
        tier: "fast",
        speed: "very-fast",
        quality: "high",
        description: "Standard model used by the platform.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-2.5-flash": {
        provider: "google",
        displayName: "Gemini 2.5 Flash",
        apiModelId: "gemini-2.5-flash",
        creditCost: 1,
        tier: "fast",
        speed: "very-fast",
        quality: "high",
        description: "Fast iteration model.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-2.5-pro": {
        provider: "google",
        displayName: "Gemini 2.5 Pro",
        apiModelId: "gemini-1.5-pro-002",
        creditCost: 2,
        tier: "premium",
        speed: "fast",
        quality: "high",
        description: "Professional grade reasoning.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
    "gemini-2-pro": {
        provider: "google",
        displayName: "Gemini 2.0 Pro",
        apiModelId: "gemini-1.5-pro-002",
        creditCost: 2,
        tier: "premium",
        speed: "fast",
        quality: "high",
        description: "Professional grade reasoning.",
        supportsVision: true,
        maxOutputTokens: 32768,
    },
};

export const DEFAULT_MODEL = "gemini-3.1-flash";

export function getModel(model: string, env: Env): LanguageModel {
    const config = MODEL_REGISTRY[model];
    if (!config) throw new Error(`Unknown model: ${model}`);

    switch (config.provider) {
        case "anthropic":
            return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(
                config.apiModelId
            );

        case "openai":
            return createOpenAI({ apiKey: env.OPENAI_API_KEY })(
                config.apiModelId
            );

        case "google":
            return createGoogleGenerativeAI({
                apiKey: env.GOOGLE_AI_API_KEY,
            })(config.apiModelId);

        case "deepseek":
            return createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })(
                config.apiModelId
            );

        default:
            throw new Error(
                `Provider not implemented: ${config.provider}`
            );
    }
}