"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { 
    BarChart3, 
    Layers, 
    Cpu, 
    Zap, 
    Calendar, 
    Clock, 
    RefreshCw, 
    ArrowUpRight, 
    History 
} from "lucide-react";
import { 
    ResponsiveContainer, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    Tooltip as ChartTooltip, 
    PieChart, 
    Pie, 
    Cell, 
    Legend,
    BarChart,
    Bar
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AnalyticsData {
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
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

export default function AnalyticsPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const client = createApiClient(getToken);
            const res = await client.analytics.get();
            setData(res);
        } catch (error) {
            console.error("Error loading analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        if (isLoaded && isSignedIn) {
            fetchAnalytics();
        }
    }, [isLoaded, isSignedIn]);

    if (!mounted || loading || !data) {
        return <AnalyticsSkeleton />;
    }

    const { stats, modelUsage, timeline, recentGenerations } = data;

    // Transform modelUsage object to array for PieChart
    const pieData = Object.entries(modelUsage).map(([name, value]) => ({
        name: name.replace("gemini-", "").replace("-flash", " Flash").replace("-pro", " Pro"),
        value
    }));

    return (
        <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto">
            {/* Page Title */}
            <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <BarChart3 className="size-6 text-primary" />
                        Analytics & Performance
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Monitor your AI generations, credits usage, and workspace history.
                    </p>
                </div>
                <button
                    onClick={fetchAnalytics}
                    className="flex shrink-0 w-fit items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-150 active:scale-95"
                >
                    <RefreshCw className="size-3.5 text-muted-foreground" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Total Projects */}
                <Card className="bg-card/45 backdrop-blur-md border-border/80 relative overflow-hidden group transition-all duration-200 hover:border-primary/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none blur-md transition-all duration-300 group-hover:bg-primary/10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Projects
                        </CardTitle>
                        <Layers className="size-4.5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.totalProjects}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Active workspaces created</p>
                    </CardContent>
                </Card>

                {/* AI Generations */}
                <Card className="bg-card/45 backdrop-blur-md border-border/80 relative overflow-hidden group transition-all duration-200 hover:border-accent/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-bl-full pointer-events-none blur-md transition-all duration-300 group-hover:bg-accent/10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            AI Generations
                        </CardTitle>
                        <Cpu className="size-4.5 text-accent" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.totalGenerations}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Total model runs & edits</p>
                    </CardContent>
                </Card>

                {/* Credits Used */}
                <Card className="bg-card/45 backdrop-blur-md border-border/80 relative overflow-hidden group transition-all duration-200 hover:border-emerald-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none blur-md transition-all duration-300 group-hover:bg-emerald-500/10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Credits Spent
                        </CardTitle>
                        <Zap className="size-4.5 text-emerald-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.creditsUsed}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {stats.creditsRemaining === -1 
                                ? "Unlimited quota on Pro plan" 
                                : `${stats.creditsRemaining} remaining this month`}
                        </p>
                    </CardContent>
                </Card>

                {/* User Plan */}
                <Card className="bg-card/45 backdrop-blur-md border-border/80 relative overflow-hidden group transition-all duration-200 hover:border-violet-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-full pointer-events-none blur-md transition-all duration-300 group-hover:bg-violet-500/10" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Active Subscription
                        </CardTitle>
                        <div className="size-4.5 flex items-center justify-center font-bold text-violet-500">
                            ★
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black uppercase tracking-wide bg-gradient-to-r from-primary via-accent to-violet-400 bg-clip-text text-transparent">
                            {stats.plan} tier
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Full feature set enabled</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Generation Activity Line Chart */}
                <Card className="md:col-span-2 bg-card/30 border-border/60">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                            <Calendar className="size-4 text-primary" />
                            Activity & Velocity
                        </CardTitle>
                        <CardDescription className="text-[10px]">
                            Daily volume of projects and AI generation updates
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] pl-0">
                        {timeline.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorGenerations" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        allowDecimals={false}
                                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <ChartTooltip 
                                        contentStyle={{ 
                                            background: "rgba(13, 14, 18, 0.95)",
                                            border: "1px solid rgba(255, 255, 255, 0.08)",
                                            borderRadius: "8px",
                                            color: "#fff",
                                            fontSize: "11px"
                                        }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="generations" 
                                        name="Generations"
                                        stroke="#6366f1" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorGenerations)" 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="projects" 
                                        name="New Projects"
                                        stroke="#ec4899" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorProjects)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No activity recorded yet
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Model Usage Pie Chart */}
                <Card className="bg-card/30 border-border/60">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                            <Cpu className="size-4 text-accent" />
                            Model Distribution
                        </CardTitle>
                        <CardDescription className="text-[10px]">
                            Breakdown of AI engines powering your generations
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] flex flex-col justify-center items-center">
                        {pieData.length > 0 ? (
                            <>
                                <div className="w-full h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={70}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <ChartTooltip
                                                contentStyle={{ 
                                                    background: "rgba(13, 14, 18, 0.95)",
                                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                                    borderRadius: "8px",
                                                    color: "#fff",
                                                    fontSize: "11px"
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] w-full px-2">
                                    {pieData.map((entry, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5">
                                            <span 
                                                className="size-2 rounded-full shrink-0" 
                                                style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                                            />
                                            <span className="truncate text-muted-foreground">
                                                {entry.name}: <strong className="text-foreground">{entry.value}</strong>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No models recorded yet
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Generations List */}
            <Card className="bg-card/20 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                            <History className="size-4 text-muted-foreground" />
                            Recent Generation Runs
                        </CardTitle>
                        <CardDescription className="text-[10px]">
                            Audit log of the last 10 AI operations executed in your workspace
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    {recentGenerations.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-semibold">
                                        <th className="p-3">Project</th>
                                        <th className="p-3">Version</th>
                                        <th className="p-3">Trigger Type</th>
                                        <th className="p-3">AI Engine</th>
                                        <th className="p-3">Prompt Description</th>
                                        <th className="p-3">Files</th>
                                        <th className="p-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentGenerations.map((gen, index) => (
                                        <tr 
                                            key={index}
                                            className="border-b border-border/30 hover:bg-muted/10 transition-colors duration-150"
                                        >
                                            <td className="p-3 font-semibold text-foreground truncate max-w-[150px]">
                                                {gen.projectName}
                                            </td>
                                            <td className="p-3">
                                                <span className="rounded-full bg-muted/70 px-2 py-0.5 font-mono text-[10px]">
                                                    v{gen.versionNumber}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={cn(
                                                    "rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                                                    gen.type === "ai" 
                                                        ? "bg-primary/10 text-primary" 
                                                        : gen.type === "manual" 
                                                            ? "bg-emerald-500/10 text-emerald-500" 
                                                            : "bg-amber-500/10 text-amber-500"
                                                )}>
                                                    {gen.type}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-muted-foreground text-[10px]">
                                                {gen.model.replace("gemini-", "")}
                                            </td>
                                            <td className="p-3 max-w-xs truncate text-muted-foreground" title={gen.prompt}>
                                                {gen.prompt || <em className="text-muted-foreground/40">Initial project layout</em>}
                                            </td>
                                            <td className="p-3 font-medium text-foreground">{gen.fileCount}</td>
                                            <td className="p-3 text-muted-foreground flex items-center gap-1">
                                                <Clock className="size-3 text-muted-foreground/60" />
                                                {new Date(gen.createdAt).toLocaleDateString()} {new Date(gen.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                            No generation runs found. Create a project to populate metrics.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function AnalyticsSkeleton() {
    return (
        <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto animate-pulse">
            <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-56 rounded" />
                <Skeleton className="h-4 w-96 rounded" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Skeleton className="md:col-span-2 h-[340px] rounded-xl" />
                <Skeleton className="h-[340px] rounded-xl" />
            </div>

            <Skeleton className="h-72 rounded-xl" />
        </div>
    );
}