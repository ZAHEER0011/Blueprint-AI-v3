import { Hono } from "hono";
import { Env, AppVariables } from "../types";
import { Project } from "../types/project";
import { sanitizeProjectName } from "../services/sanitize";
import { FREE_PROJECT_LIMIT, getCredits } from "../services/credits";
import { nanoid } from "nanoid"
import { createInitialVersion } from "../ai/default-project";

// * Endpoints:
// * GET    /api/projects        - List all projects for the authenticated user
// * GET    /api/projects/:id    - Get a single project by ID (with ownership check)
// * POST   /api/projects        - Create a new project (generates starter files)
// * PATCH  /api/projects/:id    - Update project name or model
// * DELETE /api/projects/:id    - Delete a project and all its files

const projectRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

// * GET    /api/projects        - List all projects for the authenticated user
projectRoutes.get("/", async (c) => {
    const userId = c.var.userId;
    const projectIds = (await c.env.METADATA.get<string[]>(`user-projects:${userId}`, "json")) || [];

    if (!projectIds || projectIds.length === 0) {
        return c.json({ projects: [] });
    }

    const projects = await Promise.all(
        projectIds.map(async (projectId) =>
            c.env.METADATA.get<Project>(`project:${projectId}`, "json"),
        )
    );

    const validProjects = projects.filter((p): p is Project => p !== null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return c.json({ projects: validProjects });
})

// * GET    /api/projects/:id    - Get a single project by ID (with ownership check)
projectRoutes.get("/:id", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("id");

    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");

    if (!project) {
        return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
    }

    if (project.userId !== userId) {
        return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
    }

    return c.json({ project });
});

// GET /api/projects/:id/files - Get all files for a project (with ownership check)

projectRoutes.get("/:id/files", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("id");

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

    const versionKey = `${projectId}/v${project.currentVersion}/files.json`

    const versionObject = await c.env.FILES.get(versionKey)

    if (!versionObject) {
        return c.json({ error: "Files not found", code: "NOT_FOUND" }, 404)
    }

    const version = (await versionObject.json()) as {
        files: Array<{ path: string; content: string }>;
    };

    return c.json({
        files: version.files,
        version: project.currentVersion
    });

});

// * POST   /api/projects        - Create a new project (generates starter files)
/*
 * 1. A unique nanoid
 * 2. Project metadata stored in KV
 * 3. The user's project ID list updated in KV
 * 4. Starter template files stored in R2 as version 0
 *
 * Request body: { name: string; model: string; description?: string }
 */

projectRoutes.post("/", async (c) => {
    const userId = c.var.userId;

    const body = await c.req.json<{
        name: string;
        model: string;
        description?: string;
    }>();

    const sanitizedName = sanitizeProjectName(body.name);

    if (!sanitizedName) {
        return c.json(
            { error: "Invalid project name", code: "INVALID_NAME" },
            400
        );
    }

    const credits = await getCredits(userId, c.env);

    if (credits.plan === "free") {
        const existingIds = await c.env.METADATA.get<string[]>(
            `user-projects:${userId}`,
            "json"
        );

        const projectCount = existingIds ? existingIds.length : 0;

        if (projectCount >= FREE_PROJECT_LIMIT) {
            return c.json(
                {
                    error: `Free plan is limited to ${FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited projects.`,
                    code: "PROJECT_LIMIT_REACHED",
                    limit: FREE_PROJECT_LIMIT,
                    current: projectCount,
                },
                403
            );
        }
    }

    const projectId = nanoid(12);

    const now = new Date();

    const project: Project = {
        id: projectId,
        userId,
        name: sanitizedName,
        model: body.model || "gpt-4o-mini",
        currentVersion: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };

    const initialVersion = createInitialVersion(project.name, project.model);
    const existingIds = await c.env.METADATA.get<string[]>(
        `user-projects:${userId}`,
        "json"
    );

    const updatedIds = existingIds
        ? [...existingIds, projectId]
        : [projectId];

    await Promise.all([
        c.env.METADATA.put(
            `project:${projectId}`,
            JSON.stringify(project)
        ),
        c.env.METADATA.put(
            `user-projects:${userId}`,
            JSON.stringify(updatedIds)
        ),
        c.env.FILES.put(
            `${projectId}/v0/files.json`,
            JSON.stringify({ files: initialVersion.files })
        ),
    ]);

    return c.json({ project }, 201);

});


// * PATCH  /api/projects/:id    - Update project name or model
// Updates a users project or modal, only the project owner can update it.
// Request body : {name?:string:model?:string}
projectRoutes.patch("/:id", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("id");

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

    const body = await c.req.json<{ name?: string; model?: string }>();

    if (body.name) {
        const sanitized = sanitizeProjectName(body.name)
        if (sanitized) project.name = sanitized;
    }

    if (body.model) {
        project.model = body.model;
    }

    project.updatedAt = new Date().toISOString()

    await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project))

    return c.json({ project })
});



// * DELETE /api/projects/:id    - Delete a project and all its files
projectRoutes.delete("/:id", async (c) => {
    const userId = c.var.userId;
    const projectId = c.req.param("id");

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

    // Delete project metadata
    const existingIds = await c.env.METADATA.get<string[]>(
        `user-projects:${userId}`,
        "json"
    );

    const updatedIds = (existingIds ?? []).filter(
        (id) => id !== projectId
    );

    const r2Objects = await c.env.FILES.list({
        prefix: `${projectId}/`
    });

    const deletePromises = r2Objects.objects.map((obj) =>
        c.env.FILES.delete(obj.key)
    );

    await Promise.all([
        c.env.METADATA.delete(`project:${projectId}`),
        c.env.METADATA.delete(`chat:${projectId}`),
        c.env.METADATA.put(
            `user-projects:${userId}`,
            JSON.stringify(updatedIds)
        ),
        ...deletePromises,
    ]);

    return c.json({
        message: "Project deleted successfully",
        success: true
    });
});



export { projectRoutes }