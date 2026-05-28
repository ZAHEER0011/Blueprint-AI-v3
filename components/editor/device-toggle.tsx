"use client";

import { cn } from "@/lib/utils";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import React from "react";

export type DeviceMode = "desktop" | "tablet" | "phone";

export interface DeviceToggleProps {
    deviceMode: DeviceMode;
    onDeviceModeChange: (mode: DeviceMode) => void;
}

const DEVICES = [
    { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
    { mode: "tablet" as const, icon: Tablet, label: "Tablet (768px)" },
    { mode: "phone" as const, icon: Smartphone, label: "Phone (375px)" },
] as const;

export function DeviceToggle({
    deviceMode,
    onDeviceModeChange,
}: DeviceToggleProps) {
    return (
        <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
            {DEVICES.map((device) => {
                const isActive = deviceMode === device.mode;

                return (
                    <button
                        key={device.mode}
                        onClick={() => onDeviceModeChange(device.mode)}
                        title={device.label}
                        aria-label={`Preview as ${device.label}`}
                        className={cn(
                            "flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-all duration-150",
                            isActive
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <device.icon className="size-3.5" />
                    </button>
                );
            })}
        </div>
    );
}