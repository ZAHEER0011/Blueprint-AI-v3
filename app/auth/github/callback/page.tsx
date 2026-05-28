"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Github, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function GithubCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
    const [errorMessage, setErrorMessage] = useState("");
    
    // Prevent double-trigger in strict mode
    const exchangeTriggered = useRef(false);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || exchangeTriggered.current) return;

        const code = searchParams.get("code");
        const state = searchParams.get("state"); // optional project ID

        if (!code) {
            setStatus("error");
            setErrorMessage("Authorization code is missing from the callback parameters.");
            return;
        }

        const exchangeCode = async () => {
            exchangeTriggered.current = true;
            try {
                const client = createApiClient(getToken);
                await client.settings.connectGithubOauth(code);
                
                // Dispatch event to refresh state across components
                window.dispatchEvent(new CustomEvent("github-status-changed"));
                
                setStatus("success");
                toast.success("Successfully connected to GitHub!");

                setTimeout(() => {
                    if (state && state !== "null" && state !== "undefined") {
                        router.push(`/project/${state}`);
                    } else {
                        router.push("/settings?tab=integrations");
                    }
                }, 1500);
            } catch (error: any) {
                console.error("OAuth handshake error:", error);
                setStatus("error");
                setErrorMessage(error.message || "Failed to exchange authorization token.");
                toast.error(error.message || "GitHub authentication failed.");
            }
        };

        exchangeCode();
    }, [isLoaded, isSignedIn, searchParams, getToken, router]);

    return (
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/45 backdrop-blur-xl p-8 shadow-2xl relative z-10 text-center space-y-6">
            {status === "connecting" && (
                <div className="space-y-6 py-4 animate-in fade-in duration-300">
                    <div className="relative flex items-center justify-center mx-auto size-20">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <Github className="size-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight">Connecting to GitHub</h2>
                        <p className="text-sm text-muted-foreground">
                            Completing secure OAuth authentication handshake...
                        </p>
                    </div>
                </div>
            )}

            {status === "success" && (
                <div className="space-y-6 py-4 animate-in scale-in duration-300">
                    <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto">
                        <CheckCircle className="size-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight text-emerald-400">Connection Successful!</h2>
                        <p className="text-sm text-muted-foreground">
                            Redirecting you back to your workspace...
                        </p>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="space-y-6 py-4 animate-in scale-in duration-300">
                    <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 text-destructive mx-auto">
                        <AlertTriangle className="size-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight text-destructive">Authentication Failed</h2>
                        <p className="text-xs text-muted-foreground font-mono bg-destructive/5 rounded-lg border border-destructive/10 p-3 max-h-32 overflow-y-auto">
                            {errorMessage}
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/settings?tab=integrations")}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                        Return to Settings
                    </button>
                </div>
            )}
        </div>
    );
}

export default function GithubCallbackPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground relative overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <Suspense fallback={
                <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/45 backdrop-blur-xl p-8 shadow-2xl text-center space-y-6">
                    <div className="relative flex items-center justify-center mx-auto size-20">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <Github className="size-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight animate-pulse">Loading auth session...</h2>
                    </div>
                </div>
            }>
                <GithubCallbackContent />
            </Suspense>
        </div>
    );
}
