import { ChatMessage } from "@/types/chat";
import { Project, ProjectFile, VersionMeta } from "@/types/project";

export const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787"

export interface ApiError {
    error: string;
    code: string
}

type GetTokenFunction = () => Promise<string | null>

async function authenticatedFetch<T>(getToken: GetTokenFunction, path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken()
    if (!token) {
        throw new Error("Not Authenticated - no session token available")
    }
    const response = await fetch(`${WORKER_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        }
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
            error: "Unknown error",
            code: "UNKNOWN_ERROR",
        })) as { error: string; code: string; retryAfter?: number };

        if (response.status === 429) {
            const retryAfter = errorBody.retryAfter ?? 60;
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("rate-limited", { detail: { retryAfter } })
                )
            }
        }
        throw new Error(errorBody.error || `Request failed with satus ${response.status}`)
    }
    return response.json() as Promise<T>;
}

export function createApiClient(getToken: GetTokenFunction) {
    return {
        projects: {
            list: () =>
                authenticatedFetch<{ projects: Project[] }>(
                    getToken,
                    "/api/projects"
                ),

            get: (id: string) =>
                authenticatedFetch<{ project: Project }>(
                    getToken,
                    `/api/projects/${id}`
                ),

            getFiles: (id: string) =>
                authenticatedFetch<{ files: ProjectFile[]; version: number }>(
                    getToken,
                    `/api/projects/${id}/files`
                ),

            create: (data: { name: string; model: string; description?: string }) =>
                authenticatedFetch<{ project: Project }>(
                    getToken,
                    "/api/projects",
                    {
                        method: "POST",
                        body: JSON.stringify(data),
                    }
                ),

            update: (id: string, data: { name?: string; model?: string }) =>
                authenticatedFetch<{ project: Project }>(
                    getToken,
                    `/api/projects/${id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(data),
                    }
                ),

            delete: (id: string) =>
                authenticatedFetch<{ success: boolean }>(
                    getToken,
                    `/api/projects/${id}`,
                    {
                        method: "DELETE",
                    }
                ),
        },
        chats: {
            getHistory: (projectId: string) =>
                authenticatedFetch<{ messages: ChatMessage[] }>(
                    getToken,
                    `/api/chat/${projectId}`
                ),
        },

        credits: {
            get: () =>
                authenticatedFetch<{
                    remaining: number;
                    total: number;
                    plan: "free" | "pro";
                    periodEnd: string;
                    isUnlimited: boolean;
                }>(getToken, `/api/credits`),
        },

        versions: {
            list: (projectId: string) =>
                authenticatedFetch<{ versions: VersionMeta[] }>(
                    getToken,
                    `/api/projects/${projectId}/versions`
                ),
        },

        settings: {
            getGithub: () =>
                authenticatedFetch<{
                    connected: boolean;
                    username?: string;
                    avatarUrl?: string;
                    name?: string;
                }>(getToken, "/api/settings/github"),
            connectGithub: (token: string) =>
                authenticatedFetch<{
                    connected: boolean;
                    username: string;
                    avatarUrl: string;
                    name: string;
                }>(getToken, "/api/settings/github", {
                    method: "POST",
                    body: JSON.stringify({ token }),
                }),
            connectGithubOauth: (code: string) =>
                authenticatedFetch<{
                    connected: boolean;
                    username: string;
                    avatarUrl: string;
                    name: string;
                }>(getToken, "/api/settings/github/oauth", {
                    method: "POST",
                    body: JSON.stringify({ code }),
                }),
            disconnectGithub: () =>
                authenticatedFetch<{ success: boolean }>(getToken, "/api/settings/github", {
                    method: "DELETE",
                }),
            getGithubToken: () =>
                authenticatedFetch<{ token: string }>(getToken, "/api/settings/github/token"),
        },

        analytics: {
            get: () =>
                authenticatedFetch<{
                    stats: {
                        totalProjects: number;
                        totalGenerations: number;
                        creditsRemaining: number;
                        creditsTotal: number;
                        creditsUsed: number;
                        plan: "free" | "pro";
                    };
                    modelUsage: Record<string, number>;
                    timeline: Array<{
                        date: string;
                        projects: number;
                        generations: number;
                    }>;
                    recentGenerations: Array<{
                        projectId: string;
                        projectName: string;
                        versionNumber: number;
                        type: string;
                        prompt: string;
                        model: string;
                        createdAt: string;
                        fileCount: number;
                    }>;
                    projects: Array<{
                        id: string;
                        name: string;
                        model: string;
                        versionCount: number;
                        createdAt: string;
                        updatedAt: string;
                    }>;
                }>(getToken, "/api/analytics"),
        },

    };
}