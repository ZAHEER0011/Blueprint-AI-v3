"use client"

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider, useTheme } from "./Theme-Provider";
import { dark } from "@clerk/themes"


function ClerkWithTheme({ children }: { children: React.ReactNode }) {
    const { theme } = useTheme();

    const isDark = theme === "dark" ||
        (theme === "system" && (typeof window === "undefined" ||
            window.matchMedia("(prefers-color-scheme: dark)").matches));


    return (
        <ClerkProvider
            appearance={{
                baseTheme: isDark ? dark : undefined,
            }}
        >
            {children}
        </ClerkProvider>
    )
}

export function Providers({ children }: { children: React.ReactNode }) {
    return <ThemeProvider defaultTheme="dark">
        <ClerkWithTheme>{children}</ClerkWithTheme>
    </ThemeProvider>
}