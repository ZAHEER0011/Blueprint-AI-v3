"use client";

import Link from "next/link";
import React from "react";
import { useAuth } from "@clerk/nextjs";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ArrowRight, Plus, Terminal, Sparkles, Code2, Play, GitBranch } from "lucide-react";

export function Hero() {
    const { isSignedIn } = useAuth();
    const destination = isSignedIn ? "/dashboard" : "/sign-up";

    const handleOpenReport = () => {
        window.open("/project-report/FINAL_REPORT_BLUEPRINT_AI.pdf", "_blank");
    };

    return (
        <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#08080A] via-[#0B0B0F] to-[#121217] px-6 pt-24 pb-16 overflow-hidden">
            {/* Cyber Glow Background Tones */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[80%] rounded-full bg-indigo-500/5 blur-[160px] pointer-events-none" />
            </div>

            <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">

                {/* Left Side: Impact Copy & Actions */}
                <div className="flex flex-col items-start text-left space-y-6 lg:max-w-xl">
                    <Link href={destination}>
                        <Badge
                            variant="secondary"
                            className="gap-2 border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400 backdrop-blur-sm transition-all duration-150 hover:bg-emerald-500/10 hover:border-emerald-500/25"
                        >
                            <Sparkles className="size-3.5 text-emerald-400" />
                            <span>Introducing WebCraft v3.0</span>
                            <ArrowRight className="size-3" />
                        </Badge>
                    </Link>

                    <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
                        The AI Engine for <br />
                        <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                            Web Application
                        </span> <br />
                        Software Synthesis.
                    </h1>

                    <p className="text-base text-white/60 leading-relaxed">
                        An autonomous framework that translates natural language prompts into working code. Describe your vision, edit code in real-time, inspect files, and synchronize directly to GitHub repositories.
                    </p>

                    {/* Quick Features List */}
                    <div className="grid grid-cols-2 gap-4 w-full pt-2">
                        <div className="flex items-center gap-2 text-xs text-white/70">
                            <span className="flex size-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">✓</span>
                            <span>Secure Sandpack Preview</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                            <span className="flex size-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">✓</span>
                            <span>Clerk Session Security</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                            <span className="flex size-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">✓</span>
                            <span>ZIP & GitHub OAuth Sync</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                            <span className="flex size-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">✓</span>
                            <span>Recharts Core Analytics</span>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold hover:opacity-95 hover:shadow-lg hover:shadow-emerald-500/15 border-0 text-sm h-11 px-6 rounded-lg"
                            asChild
                        >
                            <Link href={destination}>
                                Get Started Free
                                <ArrowRight className="size-4 ml-1.5" />
                            </Link>
                        </Button>
                        {/* <Button
                            variant="outline"
                            size="lg"
                            onClick={handleOpenReport}
                            className="border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white text-sm h-11 px-6 rounded-lg font-semibold"
                        >
                            View Project Report
                        </Button> */}
                    </div>
                </div>

                {/* Right Side: High-Fidelity IDE Mockup with Input Console */}
                <div className="w-full relative animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="absolute inset-0 bg-emerald-500/5 blur-[60px] rounded-3xl" />

                    {/* Simulated IDE Frame */}
                    <div className="w-full rounded-2xl border border-border/80 bg-card/45 backdrop-blur-xl shadow-2xl overflow-hidden relative z-10">
                        {/* Tab Bar */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
                            <div className="flex items-center gap-1.5">
                                <span className="size-3 rounded-full bg-destructive/60" />
                                <span className="size-3 rounded-full bg-amber-500/60" />
                                <span className="size-3 rounded-full bg-emerald-500/60" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 px-3 py-1 rounded bg-background border border-border/30 text-[10px] font-mono text-muted-foreground">
                                    <Terminal className="size-3 text-emerald-400" />
                                    <span>webcraft-terminal</span>
                                </div>
                            </div>
                            <div className="w-12" /> {/* spacer */}
                        </div>

                        {/* Simulated Execution/Handshake Logger */}
                        <div className="p-5 font-mono text-xs text-white/80 space-y-2.5 text-left bg-black/25">
                            <div className="flex items-center gap-2 text-white/40">
                                <span>[sys] initializing webcraft software synthesis kernel v3.0...</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400">✓</span>
                                <span>Clerk Auth Session handshake complete</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400">✓</span>
                                <span>MongoDB KV Metadata mapping initialized</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400">✓</span>
                                <span>Gemini LLM system prompt compiler registered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400">✓</span>
                                <span>GitHub OAuth redirection parameters verified</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/30">
                                <span>$ await user input console authorization...</span>
                            </div>
                        </div>

                        {/* Interactive Command Prompt Box (Redirects to clerk/dashboard) */}
                        <div className="p-4 border-t border-border/40 bg-muted/20">
                            <Link href={destination} className="block">
                                <div className="group relative overflow-hidden rounded-xl border border-white/10 hover:border-emerald-500/30 bg-[#121215]/80 shadow-md transition-all duration-300">

                                    {/* Prompt text area mockup */}
                                    <div className="px-4 py-4 text-left">
                                        <p className="text-xs sm:text-sm text-white/40 font-medium group-hover:text-white/50 transition-colors">
                                            Ask WebCraft to create a landing page for your next big idea...
                                        </p>
                                    </div>

                                    {/* Action row mock */}
                                    <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-white/5">

                                        {/* Left: attachment mockup */}
                                        <div className="flex items-center">
                                            <div className="flex size-7 items-center justify-center rounded-lg bg-white/5 text-white/30 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-all duration-300">
                                                <Plus className="size-4" />
                                            </div>
                                        </div>

                                        {/* Right: action buttons mockup */}
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-white/50">
                                                Plan
                                            </div>
                                            <div className="flex size-7 items-center justify-center rounded-full bg-white/10 group-hover:bg-emerald-500 text-white/50 group-hover:text-black transition-all duration-300">
                                                <ArrowRight className="size-3.5" />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}