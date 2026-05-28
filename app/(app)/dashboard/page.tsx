"use client"

import { CreateProjectDialog, EmptyState, ProjectGrid } from "@/components/dashboard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createApiClient } from "@/lib/api-client";
import { Project } from "@/types/project";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DashboardPage = () => {

    const { getToken } = useAuth()
    const router = useRouter()

    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)

    const [projectFiles, setProjectFiles] = useState<
        Record<string, Record<string, string> | undefined>
    >({});

    const fetchProjects = useCallback(async () => {
        try {
            const client = createApiClient(getToken);
            const data = await client.projects.list();
            setProjects(data.projects);
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Delete target state
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // ID of the project being renamed (null = dialog closed)
    const [renameTarget, setRenameTarget] = useState<string | null>(null);

    // Current value of the rename input
    const [renameValue, setRenameValue] = useState("");

    // Ref for auto-focusing the rename input
    const renameInputRef = useRef<HTMLInputElement>(null);

    function handleRename(id: string) {
        const project = projects.find((p) => p.id === id);
        if (!project) return;

        setRenameValue(project.name);
        setRenameTarget(id);

        // Auto-focus after the dialog renders
        setTimeout(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }, 50);
    }

    async function confirmRename() {
        if (!renameTarget) return;

        const trimmed = renameValue.trim();
        const original = projects.find((p) => p.id === renameTarget);

        if (!trimmed || trimmed === original?.name) {
            setRenameTarget(null);
            return;
        }

        // Optimistic update
        setProjects((prev) =>
            prev.map((p) =>
                p.id === renameTarget ? { ...p, name: trimmed } : p
            )
        );

        setRenameTarget(null);

        try {
            const client = createApiClient(getToken);
            await client.projects.update(renameTarget, { name: trimmed });
            toast.success("Project renamed");
        } catch {
            // Revert on failure
            setProjects((prev) =>
                prev.map((p) =>
                    p.id === renameTarget
                        ? { ...p, name: original?.name ?? p.name }
                        : p
                )
            );

            toast.error("Failed to rename project");
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            const client = createApiClient(getToken);
            await client.projects.delete(deleteTarget);

            setProjects((previous) =>
                previous.filter((project) => project.id !== deleteTarget)
            );

            // Clean up files state
            setProjectFiles((prev) => {
                const next = { ...prev };
                delete next[deleteTarget];
                return next;
            });

            toast.success("Project deleted.");
        } catch (error) {
            console.error("Failed to delete project:", error);
            toast.error("Failed to delete project. Try again.");
        } finally {
            setDeleteTarget(null);
        }
    }

    useEffect(() => {
        if (projects.length === 0) return;

        let mounted = true;
        const client = createApiClient(getToken);

        projects.forEach((project) => {
            // Skip if already fetched
            if (projectFiles[project.id] !== undefined) return;

            client.projects
                .getFiles(project.id)
                .then((data) => {
                    if (!mounted) return;

                    // Convert ProjectFile[] to Record<string, string>
                    const fileRecord: Record<string, string> = {};

                    for (const file of data.files) {
                        fileRecord[file.path] = file.content;
                    }

                    setProjectFiles((prev) => ({
                        ...prev,
                        [project.id]: fileRecord,
                    }));
                })
                .catch(() => {
                    if (!mounted) return;

                    // On error, set empty object so it shows the fallback gradient
                    setProjectFiles((prev) => ({
                        ...prev,
                        [project.id]: {},
                    }));
                });
        });
    }, [projects, projectFiles, getToken]);


    const handleCreateProject = async (data: { name: string; model: string; description: string }) => {
        try {
            const client = createApiClient(getToken);
            const response = await client.projects.create(data);

            try {
                sessionStorage.setItem(
                    `pending_prompt_${response.project.id}`,
                    data.description.trim()
                );
            } catch { }

            router.push(`/project/${response.project.id}`);
        } catch (error) {
            console.error("Error creating project:", error);

            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to create project";

            toast.error(message);
        }
    }

    function handleDelete(id: string) {
        setDeleteTarget(id);
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Projects</h1>

                <Button
                    onClick={() => setDialogOpen(true)}
                    className="gap-2"
                >
                    <Plus className="size-4" />
                    Create Project
                </Button>
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton
                            key={index}
                            className="h-[240px] rounded-xl"
                        />
                    ))}
                </div>
            ) : projects.length > 0 ? (
                <ProjectGrid
                    projects={projects}
                    projectFiles={projectFiles}
                    onNewProject={() => setDialogOpen(true)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                />
            ) : (
                <EmptyState
                    onCreateProject={() => setDialogOpen(true)}
                />
            )}

            <CreateProjectDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleCreateProject}
            />

            <Dialog
                open={renameTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRenameTarget(null);
                }}
            >
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Rename project</DialogTitle>
                        <DialogDescription>
                            Enter a new name for your project.
                        </DialogDescription>
                    </DialogHeader>

                    <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                confirmRename();
                            }

                            if (event.key === "Escape") {
                                setRenameTarget(null);
                            }
                        }}
                        placeholder="Project name"
                        maxLength={100}
                    />

                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRenameTarget(null)}
                        >
                            Cancel
                        </Button>

                        <Button
                            size="sm"
                            onClick={confirmRename}
                            disabled={
                                !renameValue.trim() ||
                                renameValue.trim() ===
                                projects.find((p) => p.id === renameTarget)?.name
                            }
                        >
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the project and all its versions.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>

                        <AlertDialogAction
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default DashboardPage;