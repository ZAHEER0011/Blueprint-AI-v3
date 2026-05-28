"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogFooter, DialogHeader } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const AI_MODELS = [
    { value: "gemini-3.1-flash", label: "Gemini 3.1 Flash (Free - Default)", disabled: false },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Premium)", disabled: true },
    { value: "gpt-4o", label: "GPT-4o (Premium)", disabled: true },
    { value: "gemini-2-pro", label: "Gemini 2.0 Pro (Premium)", disabled: true },
    { value: "claude-sonnet-4-5", label: "Claude 3.5 Sonnet (Premium)", disabled: true },
    { value: "claude-haiku-3-5", label: "Claude 3.5 Haiku (Premium)", disabled: true },
    { value: "deepseek-v3", label: "DeepSeek V3 (Premium)", disabled: true },
    { value: "deepseek-r1", label: "DeepSeek R1 (Premium)", disabled: true },
] as const;

export interface CreateProjectData {
    name: string;
    description: string;
    model: string;
}

export interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: CreateProjectData) => void;
}

export function CreateProjectDialog({
    open, onOpenChange, onSubmit,
}: CreateProjectDialogProps) {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [model, setModel] = useState<string>(AI_MODELS[0].value)

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event?.preventDefault()

        const trimmedName = name.trim()
        if (!trimmedName) return;

        onSubmit({ name: trimmedName, description: description.trim(), model })

        setName("");
        setDescription("")
        setModel(AI_MODELS[0].value)

    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Launch a New Project</DialogTitle>
                    <DialogDescription>
                        Define your vision and let AI bring it to life. Describe what you want to build, and WebCraft will generate your app instantly.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="project-name" className="text-sm font-medium">
                            Project Name
                        </label>
                        <Input
                            placeholder="My awesome app"
                            id="project-name"
                            value={name}
                            autoFocus
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="ai-model" className="text-sm font-medium">
                            AI Engine
                        </label>

                        <Select value={model} onValueChange={setModel}>
                            <SelectTrigger id="ai-model">
                                <SelectValue placeholder="Choose your AI engine" />
                            </SelectTrigger>

                            <SelectContent>
                                {AI_MODELS.map((aiModel) => (
                                    <SelectItem key={aiModel.value} value={aiModel.value} disabled={aiModel.disabled}>
                                        {aiModel.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor="project-description"
                            className="text-sm font-medium"
                        >
                            Project Vision
                        </label>

                        <Textarea
                            id="project-description"
                            placeholder="Describe the product you want to build — features, design, and goals. WebCraft will transform it into a powerful, production-ready application."
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={!name.trim() || !description.trim()}
                        >
                            Generate Project
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}