/**
 * worker/src/routes/versions.ts
 *
 * Version management endpoints for the editor.
 * Versions are stored in R2 as `{projectId}/v{versionNumber}/files.json`.
 * Version metadata is stored inside each version object.
 *
 * Endpoints:
 *   GET  /api/versions/:projectId          - List all version metadata for a project
 *   GET  /api/versions/:projectId/:version - Get files for a specific version
 *   POST /api/versions/:projectId          - Create a new version (manual save or restore)
 */

import { Hono } from "hono";
import { Env, AppVariables } from "../types";
import { Project, Version, VersionMeta } from "../types/project";

const versionRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/versions/:projectId
 * Lists all version metadata for a project (without full file contents).
 * Used by the version timeline in the editor.
 */
versionRoutes.get("/:projectId/versions", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("projectId");

    const project = await c.env.METADATA.get<Project>(
        `project:${projectId}`,
        "json"
    );

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
    }

    // Fetch all versions from v0 to currentVersion
    const versionPromises: Promise<VersionMeta | null>[] = [];

    for (let i = 0; i <= project.currentVersion; i++) {
        versionPromises.push(
            c.env.FILES.get(`${projectId}/v${i}/files.json`)
                .then(async (obj: any) => {
                    if (!obj) return null;
                    const data = (await obj.json()) as Version;
                    // Return metadata without the full files array
                    const meta: VersionMeta = {
                        versionNumber: data.versionNumber ?? i,
                        type: data.type ?? "ai",
                        prompt: data.prompt ?? "",
                        model: data.model ?? "",
                        createdAt: data.createdAt ?? "",
                        fileCount: data.fileCount ?? data.files?.length ?? 0,
                        changedFiles: data.changedFiles ?? [],
                        restoredFrom: data.restoredFrom,
                    };
                    return meta;
                })
                .catch(() => null)
        );
    }

    const results = await Promise.all(versionPromises);
    const versions = results.filter((v): v is VersionMeta => v !== null);

    return c.json({ versions });
});

/**
 * GET /api/versions/:projectId/:version
 * Returns the full files for a specific version.
 * Used when viewing old versions in the editor.
 */
versionRoutes.get("/:projectId/versions/:version", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("projectId");
    const versionNumber = parseInt(c.req.param("version"), 10);

    if (isNaN(versionNumber) || versionNumber < 0) {
        return c.json({ error: "Invalid version number", code: "INVALID_VERSION" }, 400);
    }

    const project = await c.env.METADATA.get<Project>(
        `project:${projectId}`,
        "json"
    );

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
    }

    const versionKey = `${projectId}/v${versionNumber}/files.json`;
    const versionObject = await c.env.FILES.get(versionKey);

    if (!versionObject) {
        return c.json({ error: "Version not found", code: "NOT_FOUND" }, 404);
    }

    const version = (await versionObject.json()) as Version;

    return c.json({
        files: version.files,
        version: versionNumber,
    });
});

/**
 * POST /api/versions/:projectId
 * Creates a new version for a project (manual save or restore).
 * Increments currentVersion in the project metadata.
 *
 * Request body: {
 *   files: Array<{ path: string; content: string }>;
 *   prompt?: string;
 *   model?: string;
 *   type: "ai" | "manual" | "restore";
 *   changedFiles?: string[];
 *   restoredFrom?: number;
 * }
 */
versionRoutes.post("/:projectId/versions", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("projectId");

    const project = await c.env.METADATA.get<Project>(
        `project:${projectId}`,
        "json"
    );

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
    }

    const body = await c.req.json<{
        files: Array<{ path: string; content: string }>;
        prompt?: string;
        model?: string;
        type: "ai" | "manual" | "restore";
        changedFiles?: string[];
        restoredFrom?: number;
    }>();

    const newVersionNumber = project.currentVersion + 1;
    const now = new Date().toISOString();

    const versionData: Version = {
        versionNumber: newVersionNumber,
        prompt: body.prompt ?? "",
        model: body.model ?? project.model,
        files: body.files,
        changedFiles: body.changedFiles ?? [],
        type: body.type,
        createdAt: now,
        fileCount: body.files.length,
        restoredFrom: body.restoredFrom,
    };

    // Update project metadata with new version number
    project.currentVersion = newVersionNumber;
    project.updatedAt = now;

    await Promise.all([
        c.env.FILES.put(
            `${projectId}/v${newVersionNumber}/files.json`,
            JSON.stringify(versionData)
        ),
        c.env.METADATA.put(
            `project:${projectId}`,
            JSON.stringify(project)
        ),
    ]);

    return c.json({
        version: newVersionNumber,
        project,
    }, 201);
});

export { versionRoutes };