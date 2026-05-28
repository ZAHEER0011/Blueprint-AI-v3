"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronDown,
    ArrowLeft,
    Settings,
    Pencil,
    Trash2,
    HelpCircle,
    Palette,
    Check,
    Monitor,
    Moon,
    Sun,
} from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "../Theme-Provider";

export interface ProjectMenuProps {
    projectName: string;
    projectId: string;
    creditsRemaining?: number;
    creditsTotal?: number;
    userPlan: "free" | "pro";
    onRename: (newName: string) => void;
    onDelete: () => void;
}

const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

export function ProjectMenu({
    projectName,
    projectId,
    creditsRemaining,
    creditsTotal = 50,
    userPlan,
    onRename,
    onDelete,
}: ProjectMenuProps) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(projectName || "");
    const renameInputRef = useRef<HTMLInputElement>(null);

    const isUnlimited = creditsRemaining === -1;
    const isPro = userPlan === "pro";

    const displayRemaining = isUnlimited
        ? creditsTotal
        : creditsRemaining ?? 0;

    const progressPercent = isUnlimited
        ? 100
        : creditsTotal > 0
            ? (displayRemaining / creditsTotal) * 100
            : 0;

    useEffect(() => {
        setRenameValue(projectName);
    }, [projectName]);

    useEffect(() => {
        if (!isRenameOpen) return;

        const timer = setTimeout(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }, 50);

        return () => clearTimeout(timer);
    }, [isRenameOpen]);

    function handleRenameConfirm() {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== projectName) {
            onRename(trimmed);
        }
        setIsRenameOpen(false);
    }

    function handleRenameKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>
    ) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleRenameConfirm();
        }
        if (e.key === "Escape") {
            setIsRenameOpen(false);
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/50 sm:px-1.5">
                        <span className="max-w-[80px] truncate text-sm font-medium sm:max-w-[180px] sm:text-base">
                            {projectName}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground sm:size-3.5" />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-64">
                    {/* Dashboard */}
                    <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                        <ArrowLeft className="mr-2 size-4" />
                        Go to Dashboard
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* User */}
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="size-8 rounded-full bg-secondary" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">User</span>
                            <Badge variant="secondary" className="mt-0.5 w-fit text-[10px] px-1.5 py-0">
                                {isPro ? "Pro plan" : "Free plan"}
                            </Badge>
                        </div>
                    </div>

                    {/* Credits */}
                    <div className="px-2 pb-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Credits</span>
                            <span>
                                {isUnlimited
                                    ? "Unlimited"
                                    : `${creditsRemaining ?? 0} / ${creditsTotal}`}
                            </span>
                        </div>

                        {!isUnlimited && (
                            <div className="h-1.5 w-full rounded-full bg-secondary">
                                <div
                                    className="h-1.5 rounded-full bg-primary transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, progressPercent)}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <DropdownMenuSeparator />

                    {/* Settings */}
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <Settings className="mr-2 size-4" />
                        Settings
                    </DropdownMenuItem>

                    {/* Rename */}
                    <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
                        <Pencil className="mr-2 size-4" />
                        Rename project
                    </DropdownMenuItem>

                    {/* Theme */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Palette className="mr-2 size-4" />
                            Appearance
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>
                            {THEME_OPTIONS.map((option) => (
                                <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => setTheme(option.value)}
                                >
                                    <option.icon className="mr-2 size-4" />
                                    {option.label}
                                    {theme === option.value && (
                                        <Check className="ml-auto size-3.5 text-primary" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Delete */}
                    <DropdownMenuItem
                        onClick={() => setIsDeleteOpen(true)}
                        className="text-destructive"
                    >
                        <Trash2 className="mr-2 size-4" />
                        Delete project
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Help */}
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <HelpCircle className="mr-2 size-4" />
                        Help
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Rename Dialog */}
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename project</DialogTitle>
                        <DialogDescription>
                            Enter a new name for your project.
                        </DialogDescription>
                    </DialogHeader>

                    <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        placeholder="Project name"
                        maxLength={100}
                    />

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsRenameOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleRenameConfirm}
                            disabled={
                                !renameValue?.trim() ||
                                renameValue?.trim() === projectName
                            }
                        >
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{projectName}</strong> and all its data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}