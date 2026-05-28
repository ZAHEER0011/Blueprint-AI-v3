"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2, FileJson, FileType2, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileTreeProps {
    files: Record<string, string>;
    activeFile: string;
    onActiveFileChange: (path: string) => void;
}

interface TreeNode {
    name: string;
    path: string;
    type: "file" | "folder";
    children?: TreeNode[];
}

function buildFileTree(files: Record<string, string>): TreeNode[] {
    const root: TreeNode[] = [];
    const pathMap = new Map<string, TreeNode>();

    // Get all paths and sort them
    const allPaths = Object.keys(files).sort();

    for (const path of allPaths) {
        const parts = path.split("/");
        let currentPath = "";
        let parentNode: TreeNode | null = null;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isLast = i === parts.length - 1;

            if (!pathMap.has(currentPath)) {
                const node: TreeNode = {
                    name: part,
                    path: currentPath,
                    type: isLast ? "file" : "folder",
                    children: isLast ? undefined : [],
                };

                pathMap.set(currentPath, node);

                if (parentNode) {
                    parentNode.children!.push(node);
                } else {
                    root.push(node);
                }
            }

            parentNode = pathMap.get(currentPath)!;
        }
    }

    return root;
}

function getFileIcon(path: string) {
    if (path.endsWith(".tsx") || path.endsWith(".ts")) {
        return <FileCode2 className="size-4 text-blue-400" />;
    }
    if (path.endsWith(".jsx") || path.endsWith(".js")) {
        return <FileCode2 className="size-4 text-yellow-400" />;
    }
    if (path.endsWith(".css")) {
        return <FileType2 className="size-4 text-sky-400" />;
    }
    if (path.endsWith(".json")) {
        return <FileJson className="size-4 text-green-400" />;
    }
    if (path.endsWith(".html")) {
        return <FileType2 className="size-4 text-orange-400" />;
    }
    return <File className="size-4 text-muted-foreground" />;
}

interface TreeItemProps {
    node: TreeNode;
    level: number;
    activeFile: string;
    onSelect: (path: string) => void;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
}

function TreeItem({
    node,
    level,
    activeFile,
    onSelect,
    expandedFolders,
    onToggleFolder,
}: TreeItemProps) {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile === node.path;

    if (node.type === "folder") {
        return (
            <div>
                <button
                    onClick={() => onToggleFolder(node.path)}
                    className={cn(
                        "flex items-center gap-1.5 w-full text-left py-1 px-1.5 text-sm rounded-sm transition-colors hover:bg-muted",
                        "text-muted-foreground hover:text-foreground"
                    )}
                    style={{ paddingLeft: `${level * 12 + 4}px` }}
                >
                    {isExpanded ? (
                        <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                        <ChevronRight className="size-3.5 shrink-0" />
                    )}
                    {isExpanded ? (
                        <FolderOpen className="size-4 text-blue-400 shrink-0" />
                    ) : (
                        <Folder className="size-4 text-blue-400 shrink-0" />
                    )}
                    <span className="truncate">{node.name}</span>
                </button>
                {isExpanded && node.children && (
                    <div>
                        {node.children.map((child) => (
                            <TreeItem
                                key={child.path}
                                node={child}
                                level={level + 1}
                                activeFile={activeFile}
                                onSelect={onSelect}
                                expandedFolders={expandedFolders}
                                onToggleFolder={onToggleFolder}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={() => onSelect(node.path)}
            className={cn(
                "flex items-center gap-1.5 w-full text-left py-1 px-1.5 text-sm rounded-sm transition-colors",
                isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            style={{ paddingLeft: `${level * 12 + 20}px` }}
        >
            {getFileIcon(node.path)}
            <span className="truncate">{node.name}</span>
        </button>
    );
}

export function FileTree({ files, activeFile, onActiveFileChange }: FileTreeProps) {
    const tree = useMemo(() => buildFileTree(files), [files]);
    
    // Auto-expand folders containing the active file
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        const parts = activeFile.split("/");
        let path = "";
        for (let i = 0; i < parts.length - 1; i++) {
            path = path ? `${path}/${parts[i]}` : parts[i];
            initial.add(path);
        }
        return initial;
    });

    const handleToggleFolder = (path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    return (
        <div className="w-64 border-r border-border bg-card flex flex-col h-full">
            <div className="p-2 px-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Explorer
            </div>
            <ScrollArea className="flex-1">
                <div className="p-1">
                    {tree.map((node) => (
                        <TreeItem
                            key={node.path}
                            node={node}
                            level={0}
                            activeFile={activeFile}
                            onSelect={onActiveFileChange}
                            expandedFolders={expandedFolders}
                            onToggleFolder={handleToggleFolder}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
