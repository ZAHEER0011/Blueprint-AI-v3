"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, LayoutDashboard, Menu, Settings, X, Zap, Infinity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import React, { useState, useEffect } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";

const NAV_ITEMS = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
] as const;

const AppLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [credits, setCredits] = useState<{
        remaining: number;
        total: number;
        plan: "free" | "pro";
        periodEnd: string;
        isUnlimited: boolean;
    } | null>(null);

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        const fetchCredits = async () => {
            try {
                const client = createApiClient(getToken);
                const data = await client.credits.get();
                setCredits(data);
            } catch (err) {
                console.error("Failed to fetch credits in layout sidebar:", err);
            }
        };

        fetchCredits();

        // Refresh credits every 30 seconds
        const interval = setInterval(fetchCredits, 30000);

        // Listen for immediate update event
        const handleRefresh = () => fetchCredits();
        window.addEventListener("refresh-credits", handleRefresh);

        return () => {
            clearInterval(interval);
            window.removeEventListener("refresh-credits", handleRefresh);
        };
    }, [isLoaded, isSignedIn, getToken]);

    const isEditorPage = pathname.startsWith("/project/") || pathname.startsWith("/preview/");

    if (isEditorPage) {
        return (
            <div className="flex h-screen flex-col bg-background text-foreground">
                {/* TODO: RateLimit Banner */}
                {/* <div>RateLimitBanner</div> */}
                <div className="flex flex-1 overflow-hidden">{children}</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* TODO: RateLimit Banner */}
            {/* <div>RateLimitBanner</div> */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={cn("fixed inset-y-0 min-h-screen left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                <div className="flex h-16 items-center justify-between px-5">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
                    >
                        WebCraft
                    </Link>

                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
                <Separator />
                <nav className="flex-1 space-y-1 px-3 py-4">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href || (item.href === "/settings" && pathname.startsWith("/settings"));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                                    isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <item.icon className="size-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Real-time Credits Component */}
                <div className="px-4 py-4 shrink-0">
                    {!credits ? (
                        <div className="space-y-2 rounded-xl bg-sidebar-accent/30 p-3.5 border border-sidebar-border animate-pulse">
                            <div className="flex justify-between items-center">
                                <div className="h-3 w-16 rounded bg-muted/60" />
                                <div className="h-3 w-8 rounded bg-muted/60" />
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted/40" />
                        </div>
                    ) : credits.plan === "pro" || credits.remaining === -1 ? (
                        <div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-4 transition-all duration-300 hover:border-primary/45 hover:shadow-[0_0_20px_rgba(109,156,255,0.08)]">
                            <div className="absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-xl transition-all duration-500 group-hover:scale-125" />
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                                    <Zap className="size-4 text-primary animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] font-bold text-foreground">Pro Plan</span>
                                        <span className="rounded bg-gradient-to-r from-primary to-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary-foreground shadow-sm">
                                            PRO
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                        Quota: <Infinity className="size-3 text-foreground" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/10 p-4 transition-all duration-200 hover:border-sidebar-border/90">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credits</span>
                                <span className="text-xs font-extrabold text-foreground">
                                    {credits.remaining} / {credits.total}
                                </span>
                            </div>
                            <div className="w-full rounded-full bg-muted/30 h-1.5 overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                                        credits.remaining < 10 
                                            ? "from-amber-500 to-rose-500" 
                                            : "from-primary to-accent"
                                    )}
                                    style={{ width: `${Math.min(100, (credits.remaining / credits.total) * 100)}%` }}
                                />
                            </div>
                            <Link 
                                href="/settings?tab=profile" 
                                className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground px-3 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 border border-border/40"
                            >
                                <Zap className="size-3 text-primary fill-primary/20 animate-bounce" />
                                Upgrade to Pro
                            </Link>
                        </div>
                    )}
                </div>
                <Separator />

                <div className="flex items-center gap-3 px-5 py-4">
                    <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
                    <span className="text-sm text-muted-foreground">Account</span>
                </div>
            </aside>
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top bar – mobile hamburger + page content header */}
                <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6 md:hidden">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="size-5" />
                    </Button>

                    <span className="flex items-center gap-2 text-sm font-semibold">
                        <img src="/logo.png" alt="" className="size-5" />
                        WebCraft
                    </span>
                </header>

                {/* Page content – scrollable area with fade-in animation */}
                <main className="flex-1 overflow-y-auto animate-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AppLayout;