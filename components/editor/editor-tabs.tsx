"use client"

import { cn } from "@/lib/utils";
import { Code2, Eye, History } from "lucide-react";

export type EditorTabValue = "preview" | "code" | "history";

export interface EditorTabsProps {
    activeTab: EditorTabValue;
    onTabChange: (tab: EditorTabValue) => void;
}

const TABS = [
    { value: "preview" as const, label: "Preview", icon: Eye },
    { value: "code" as const, label: "Code", icon: Code2 },
    { value: "history" as const, label: "History", icon: History },
] as const;

export function EditorTabs({
    activeTab,
    onTabChange,
}: EditorTabsProps) {
    return (
        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.value;

                return (
                    <button
                        key={tab.value}
                        onClick={() => onTabChange(tab.value)}
                        className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                            isActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="size-3.5" />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}