"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, useAuth } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { createApiClient } from "@/lib/api-client";
import { 
    Github, 
    User, 
    CheckCircle2, 
    XCircle, 
    ExternalLink, 
    Key, 
    Loader2, 
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface GithubStatus {
    connected: boolean;
    username?: string;
    avatarUrl?: string;
    name?: string;
}

export default function SettingsPage() {
    const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Synchronization of tabs between "profile" and "integrations"
    const activeTab = searchParams.get("tab") === "profile" ? "profile" : "integrations";

    const [ghStatus, setGhStatus] = useState<GithubStatus | null>(null);
    const [ghLoading, setGhLoading] = useState(true);
    const [tokenInput, setTokenInput] = useState("");
    const [connecting, setConnecting] = useState(false);

    const fetchGithubStatus = async () => {
        try {
            setGhLoading(true);
            const client = createApiClient(getToken);
            const status = await client.settings.getGithub();
            setGhStatus(status);
        } catch (error) {
            console.error("Failed to load GitHub status:", error);
        } finally {
            setGhLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthLoaded && isSignedIn) {
            fetchGithubStatus();
        }
    }, [isAuthLoaded, isSignedIn]);

    const handleConnectGithub = () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
        if (!clientId) {
            toast.error("GitHub Client ID is not configured. Please add NEXT_PUBLIC_GITHUB_CLIENT_ID to your .env.local file.");
            return;
        }
        setConnecting(true);
        const callbackUrl = encodeURIComponent(window.location.origin + "/auth/github/callback");
        const scope = "repo";
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${callbackUrl}`;
    };

    const handleDisconnectGithub = async () => {
        if (!confirm("Are you sure you want to disconnect GitHub?")) return;

        try {
            setGhLoading(true);
            const client = createApiClient(getToken);
            await client.settings.disconnectGithub();
            setGhStatus({ connected: false });
            toast.success("Disconnected GitHub connection.");
            
            // Dispatch event to refresh header/other components
            window.dispatchEvent(new CustomEvent("github-status-changed"));
        } catch (error: any) {
            console.error("GitHub disconnect error:", error);
            toast.error(error.message || "Failed to disconnect GitHub.");
        } finally {
            setGhLoading(false);
        }
    };

    const changeTab = (tab: "profile" | "integrations") => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`/settings?${params.toString()}`);
    };

    return (
        <div className="flex h-full max-w-7xl mx-auto overflow-hidden bg-background text-foreground flex-col md:flex-row">
            {/* Inner settings Sidebar */}
            <aside className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border p-4 flex flex-row md:flex-col gap-1.5 shrink-0">
                <button
                    onClick={() => changeTab("integrations")}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 text-left ${
                        activeTab === "integrations"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                >
                    <Github className="size-4" />
                    Integrations
                </button>
                <button
                    onClick={() => changeTab("profile")}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 text-left ${
                        activeTab === "profile"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                >
                    <User className="size-4" />
                    Account Profile
                </button>
            </aside>

            {/* Content Area */}
            <main className="flex-1 p-6 overflow-y-auto">
                {activeTab === "integrations" ? (
                    <div className="max-w-2xl space-y-6">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight mb-1 flex items-center gap-2">
                                <Github className="size-5 text-foreground" />
                                GitHub Integration
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Connect your GitHub account to sync and push generated code projects directly to repositories.
                            </p>
                        </div>

                        {ghLoading ? (
                            <Card className="bg-card/45 backdrop-blur-md border-border/80 p-8 flex items-center justify-center">
                                <Loader2 className="size-6 text-primary animate-spin" />
                            </Card>
                        ) : ghStatus?.connected ? (
                            <Card className="bg-card/45 backdrop-blur-md border-border/80 overflow-hidden relative border-emerald-500/10">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none blur-md" />
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <CheckCircle2 className="size-4 text-emerald-400" />
                                            Connection Status: Active
                                        </CardTitle>
                                        <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-400/25 animate-pulse">
                                            Live
                                        </span>
                                    </div>
                                    <CardDescription className="text-[10px]">
                                        Your account is successfully linked and ready to push projects.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="border-t border-border/30 pt-4 flex items-center gap-4">
                                    <img 
                                        src={ghStatus.avatarUrl} 
                                        alt={ghStatus.username} 
                                        className="size-14 rounded-full border border-border bg-muted shadow-sm"
                                    />
                                    <div>
                                        <div className="text-sm font-extrabold text-foreground">{ghStatus.name}</div>
                                        <a 
                                            href={`https://github.com/${ghStatus.username}`}
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                                        >
                                            @{ghStatus.username}
                                            <ExternalLink className="size-3" />
                                        </a>
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t border-border/30 bg-muted/10 px-6 py-3 flex justify-end">
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDisconnectGithub}
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs font-bold"
                                    >
                                        Disconnect Account
                                    </Button>
                                </CardFooter>
                            </Card>
                        ) : (
                            <Card className="bg-card/45 backdrop-blur-md border-border/80 overflow-hidden relative">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <AlertCircle className="size-4.5 text-amber-500" />
                                        GitHub Account Disconnected
                                    </CardTitle>
                                    <CardDescription className="text-[10px]">
                                        Authorize WebCraft to publish generated code projects directly to your GitHub repositories.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="rounded-lg bg-muted/40 p-4 border border-border/30 text-xs text-muted-foreground space-y-2.5">
                                        <div className="font-semibold text-foreground flex items-center gap-1">
                                            <span>💡</span> OAuth Access Scope:
                                        </div>
                                        <ul className="list-disc pl-5 space-y-1 text-[11px]">
                                            <li>Your authorization grants WebCraft standard <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">repo</code> scope permissions.</li>
                                            <li>This is used solely to create new repositories and upload project files on your behalf.</li>
                                        </ul>
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t border-border/30 bg-muted/10 px-6 py-3 flex justify-end">
                                    <Button 
                                        onClick={handleConnectGithub} 
                                        size="sm"
                                        disabled={connecting}
                                        className="text-xs font-bold gap-1.5"
                                    >
                                        {connecting ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Github className="size-3.5" />
                                        )}
                                        Connect GitHub via OAuth
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                ) : (
                    <div className="w-full flex justify-start">
                        {/* Clerk UserProfile page integration with custom theme and dark theme */}
                        <UserProfile 
                            routing="path" 
                            path="/settings" 
                            appearance={{ 
                                baseTheme: dark,
                                elements: {
                                    card: "bg-card border border-border rounded-xl shadow-none w-full",
                                    navbar: "border-r border-border bg-card/65",
                                    scrollBox: "bg-card",
                                    headerTitle: "text-foreground",
                                    headerSubtitle: "text-muted-foreground text-xs",
                                    profileSectionTitleText: "text-foreground font-bold",
                                    profileSectionSubtitleText: "text-muted-foreground text-xs"
                                }
                            }} 
                        />
                    </div>
                )}
            </main>
        </div>
    );
}
