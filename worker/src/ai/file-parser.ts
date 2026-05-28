/**
 * worker/src/ai/file-parser.ts
 *
 * Parses AI-generated code wrapped in XML <files> blocks and extracts
 * file contents for storage in R2 and display in the editor.
 *
 * The expected format is:
 * <files>
 *   <file path="src/App.tsx">
 *     // Code content here
 *   </file>
 * </files>
 */

import { XMLParser } from "fast-xml-parser";
import { ProjectFile } from "../types/project";

/**
 * Parsed file structure from XML
 */
interface ParsedFile {
    path?: string;
    "#text"?: string;
}

/**
 * Extracts file blocks from the AI response.
 * Handles the XML format: <files><file path="...">content</file></files>
 *
 * @param response - Raw AI response text
 * @returns Array of ProjectFile objects with path and content
 */
export function parseFilesFromResponse(response: string): ProjectFile[] {
    const files: ProjectFile[] = [];

    try {
        // Find all <files>...</files> blocks or the active streaming files block
        const filesRegex = /<files[\s\S]*?(?:<\/files>|$)/gi;
        const filesBlocks = response.match(filesRegex) || [];

        for (const block of filesBlocks) {
            const fileRegex = /<file\s+path="([^"]+)"[^>]*>([\s\S]*?)(?:<\/file>|$)/gi;
            let match;
            while ((match = fileRegex.exec(block)) !== null) {
                const path = match[1];
                let content = match[2];

                if (path && typeof path === "string") {
                    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
                    if (!isValidFilePath(normalizedPath)) {
                        continue;
                    }

                    // Clean up content - remove leading/trailing whitespace but preserve indentation
                    content = content.replace(/^\n/, "").replace(/\n$/, "");

                    // Sanitize content
                    content = sanitizeFileContent(normalizedPath, content);

                    // Dedup files - if the same file is generated multiple times in the block, the last one takes precedence
                    const existingIndex = files.findIndex(f => f.path === normalizedPath);
                    if (existingIndex !== -1) {
                        files[existingIndex] = { path: normalizedPath, content };
                    } else {
                        files.push({
                            path: normalizedPath,
                            content,
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in parseFilesFromResponse:", error);
    }

    // If no files found, try streaming parser as fallback on the whole response
    if (files.length === 0) {
        return parseStreamingFiles(response);
    }

    return files;
}

/**
 * Robustly parses files from a potentially incomplete/streaming response.
 * Uses regex to find <file path="..."> tags even if they aren't closed.
 *
 * @param response - Partial AI response text
 * @returns Array of ProjectFile objects
 */
export function parseStreamingFiles(response: string): ProjectFile[] {
    const files: ProjectFile[] = [];
    const fileRegex = /<file\s+path="([^"]+)"[^>]*>([\s\S]*?)(?:<\/file>|$)/gi;
    
    let match;
    while ((match = fileRegex.exec(response)) !== null) {
        const path = match[1];
        let content = match[2];

        // Robustness for streaming JSON:
        // If the file is a JSON and it ends with a dangling quote or comma, 
        // it might crash the frontend. We don't fix it here but we ensure 
        // we don't capture a "half-finished" line if it's the very end of the stream.
        if (path.endsWith(".json") && !response.includes("</file>", match.index)) {
            // Check if it ends in the middle of a string
            const lastQuoteIndex = content.lastIndexOf('"');
            const lastBraceIndex = content.lastIndexOf('}');
            const lastBracketIndex = content.lastIndexOf(']');
            
            // If the last quote is after the last structural character, it might be an unterminated string
            if (lastQuoteIndex > lastBraceIndex && lastQuoteIndex > lastBracketIndex) {
                 // Truncate to the last newline to be safe
                 const lastNewline = content.lastIndexOf('\n');
                 if (lastNewline > 0) {
                     content = content.slice(0, lastNewline);
                 }
            }
        }

        if (path && typeof path === "string") {
            const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
            if (!isValidFilePath(normalizedPath)) {
                continue;
            }

            content = content.replace(/^\n/, "").replace(/\n$/, "");
            content = sanitizeFileContent(normalizedPath, content);

            files.push({
                path: normalizedPath,
                content,
            });
        }
    }

    return files;
}

/**
 * Extracts the explanation text after the </files> block.
 * Returns everything after the last </files> tag, or the full response if no files block exists.
 *
 * @param response - Raw AI response text
 * @returns Explanation text
 */
export function extractExplanation(response: string): string {
    // Find the last </files> tag
    const lastFilesEnd = response.lastIndexOf("</files>");

    if (lastFilesEnd === -1) {
        // No files block found, return the full response
        return response.trim();
    }

    // Get everything after the </files> tag
    const afterFiles = response.slice(lastFilesEnd + 8); // 8 = length of "</files>"

    // Clean up the explanation
    return afterFiles.trim();
}

/**
 * Merges newly parsed files with existing files.
 * New files take precedence over existing ones (updates existing files).
 *
 * @param existingFiles - Current project files
 * @param newFiles - Newly generated files from AI
 * @returns Merged array of all files
 */
export function mergeFiles(
    existingFiles: ProjectFile[],
    newFiles: ProjectFile[]
): ProjectFile[] {
    // Create a map of existing files by path
    const fileMap = new Map<string, string>();

    for (const file of existingFiles) {
        fileMap.set(file.path, file.content);
    }

    // Apply new files (overwrites existing)
    for (const file of newFiles) {
        fileMap.set(file.path, file.content);
    }

    // Convert back to array, sorted by path
    return Array.from(fileMap.entries())
        .map(([path, content]) => ({ path, content }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

export function extractTasks(
    response: string
): Array<{ status: "pending" | "in_progress" | "completed"; description: string }> {
    const tasks: Array<{ status: "pending" | "in_progress" | "completed"; description: string }> = [];

    try {
        const taskRegex = /<task\s+status="([^"]+)"[^>]*>([^<]*)?(?:<\/task>|$)/gi;
        let match;

        while ((match = taskRegex.exec(response)) !== null) {
            const status = match[1] as "pending" | "in_progress" | "completed";
            const description = (match[2] || "").trim();

            if (description) {
                tasks.push({ status, description });
            }
        }
    } catch (error) {
        console.error("Error extracting tasks:", error);
    }

    return tasks;
}

/**
 * Validates that a file path is acceptable.
 * Prevents directory traversal and ensures proper extension.
 *
 * @param path - File path to validate
 * @returns True if path is valid
 */
export function isValidFilePath(path: string): boolean {
    // Check for directory traversal attempts
    if (path.includes("..") || path.includes("~")) {
        return false;
    }

    // Must have a valid extension
    const validExtensions = [".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".html", ".svg", ".mjs", ".env", ".env.local", ".env.development", ".env.production"];
    const hasValidExt = validExtensions.some((ext) => path.endsWith(ext));

    if (!hasValidExt) {
        return false;
    }

    // Must be within src/ or public/ directory or be a config file
    const isConfig = [
        "package.json", 
        "tsconfig.json", 
        "tailwind.config.js", 
        "tailwind.config.ts", 
        "postcss.config.js",
        "postcss.config.mjs",
        "components.json",
        ".env",
        ".env.local",
        ".env.development",
        ".env.production"
    ].includes(path);

    if (!path.startsWith("src/") && !path.startsWith("public/") && !isConfig) {
        return false;
    }

    return true;
}

/**
 * Sanitizes file content to remove any potentially harmful code or fix common errors.
 *
 * @param path - File path
 * @param content - File content to sanitize
 * @returns Sanitized content
 */
export function sanitizeFileContent(path: string, content: string): string {
    // 1. Basic safety: Remove any eval() calls (Sandpack provides real isolation, but this is a good layer)
    // content = content.replace(/eval\s*\(/g, "/* eval disabled */(");

    // 2. Fix common AI JSON errors (like trailing commas)
    if (path.endsWith(".json")) {
        try {
            // Check if it's valid JSON first
            JSON.parse(content);
        } catch {
            // If invalid, try to fix trailing commas
            // This regex finds a comma followed by a closing brace or bracket, with optional whitespace/newlines
            return content.replace(/,\s*([\]}])/g, "$1");
        }
    }

    return content;
}
