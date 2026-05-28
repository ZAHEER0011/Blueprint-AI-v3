import { FolderOpen } from "lucide-react";
import { Button } from "../ui/button";

export interface EmptyStateProps {
    onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <FolderOpen className="size-8 text-muted-foreground" />
            </div>

            <h2 className="mt-6 text-xl font-semibold">
                Your Next Big Project Starts Here
            </h2>

            <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
                Turn your ideas into powerful, production-ready web apps in minutes.
                Describe what you want, and let WebCraft build it for you.
            </p>

            <Button className="mt-6" onClick={onCreateProject}>
                Launch Your First Project
            </Button>
        </div>
    );
}