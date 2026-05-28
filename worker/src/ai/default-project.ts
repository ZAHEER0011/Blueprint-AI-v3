/**
 * worker/src/ai/default-project.ts
 *
 * Starter template files for a newly created project.
 * When a user creates a project, these files are stored in R2
 * as version 0 — the initial state before any AI generation.
 *
 * The template is a minimal React + Tailwind app with:
 * - src/App.tsx — Welcome component with project name
 * - src/index.tsx — React DOM render entry point
 * - src/index.css — Tailwind CSS imports
 * - package.json — React + Tailwind dependencies
 *
 * This matches what Sandpack expects for a React project,
 * so the preview works immediately after project creation.
 *
 * Used by: worker/src/routes/projects.ts (POST /api/projects)
 */

import type { ProjectFile, Version } from "../types/project";

/**
 * Generates the default set of files for a new project.
 * The App.tsx includes the project name in the welcome message.
 *
 * @param projectName - The name of the newly created project
 * @returns Array of ProjectFile objects for version 0
 */
export function getDefaultProjectFiles(projectName: string): ProjectFile[] {
    return [
        {
            path: "src/App.tsx",
            content: `/**
 * App.tsx — Main application component.
 * This is your starting point. Edit this file or ask AI to generate code.
 */

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ${projectName}
        </h1>
        <p className="text-lg text-gray-600">
          Start building by describing what you want in the chat.
        </p>
      </div>
    </div>
  );
}
`,
        },
        {
            path: "src/index.tsx",
            content: `/**
 * index.tsx — Application entry point.
 * Renders the App component into the DOM root element.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
        },
        {
            path: "src/index.css",
            content: `/*
 * Base styles for the app.
 * Tailwind utility classes are handled by the CDN script at runtime,
 * so no @tailwind directives are needed here.
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
        },
        {
            path: "package.json",
            content: JSON.stringify(
                {
                    name: "project",
                    private: true,
                    version: "0.0.0",
                    type: "module",
                    dependencies: {
                        react: "^18.2.0",
                        "react-dom": "^18.2.0",
                    },
                    devDependencies: {
                        "@types/react": "^18.2.0",
                        "@types/react-dom": "^18.2.0",
                        tailwindcss: "^3.4.0",
                        typescript: "^5.0.0",
                    },
                },
                null,
                2
            ) + "\n",
        },
    ];
}

/**
 * Creates the initial version (version 0) for a new project.
 * This version contains the starter template files and records
 * that it was created as an "ai" type with an empty prompt.
 *
 * @param projectName - The name of the project
 * @param model - The AI model selected for this project
 * @returns A Version object for version 0
 */
export function createInitialVersion(
    projectName: string,
    model: string
): Version {
    const files = getDefaultProjectFiles(projectName);
    return {
        versionNumber: 0,
        prompt: "Initial project setup",
        model,
        files,
        changedFiles: files.map((file) => file.path),
        type: "manual",
        createdAt: new Date().toISOString(),
        fileCount: files.length,
    };
}