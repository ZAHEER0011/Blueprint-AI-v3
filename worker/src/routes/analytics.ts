import { Hono } from "hono";
import { Env, AppVariables } from "../types";
import { Project, Version } from "../types/project";
import { getCredits } from "../services/credits";

const analyticsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/analytics
// Computes and returns real-time user-specific analytics of projects, versions, and models
analyticsRoutes.get("/", async (c) => {
    const userId = c.var.userId;

    try {
        // 1. Fetch project list
        const projectIds = (await c.env.METADATA.get<string[]>(`user-projects:${userId}`, "json")) || [];
        
        const projects = await Promise.all(
            projectIds.map(async (projectId) =>
                c.env.METADATA.get<Project>(`project:${projectId}`, "json")
            )
        );
        const validProjects = projects.filter((p): p is Project => p !== null);

        // 2. Fetch credits
        const credits = await getCredits(userId, c.env);

        // 3. Compute stats
        const totalProjects = validProjects.length;
        let totalGenerations = 0;
        const modelUsage: Record<string, number> = {};
        
        const projectsByDate: Record<string, number> = {};
        const generationsByDate: Record<string, number> = {};
        const recentGenerationsList: any[] = [];

        // Traverse projects and their versions
        for (const project of validProjects) {
            // Increments generation count by number of versions (version 0 is initial, and version currentVersion)
            const versionsCount = project.currentVersion + 1;
            totalGenerations += versionsCount;

            // Track model usage
            const projModel = project.model || "gemini-3.1-flash";
            modelUsage[projModel] = (modelUsage[projModel] || 0) + 1;

            // Group project creations by date
            const pDate = new Date(project.createdAt).toISOString().split("T")[0];
            projectsByDate[pDate] = (projectsByDate[pDate] || 0) + 1;

            // Query each version file to get generation details
            for (let v = 0; v <= project.currentVersion; v++) {
                const versionKey = `${project.id}/v${v}/files.json`;
                const versionObj = await c.env.FILES.get(versionKey);

                if (versionObj) {
                    try {
                        const versionData = (await versionObj.json()) as Version;
                        const vDate = new Date(versionData.createdAt || project.createdAt)
                            .toISOString()
                            .split("T")[0];
                        
                        generationsByDate[vDate] = (generationsByDate[vDate] || 0) + 1;

                        recentGenerationsList.push({
                            projectId: project.id,
                            projectName: project.name,
                            versionNumber: v,
                            type: versionData.type || "ai",
                            prompt: versionData.prompt || "",
                            model: versionData.model || projModel,
                            createdAt: versionData.createdAt || project.createdAt,
                            fileCount: versionData.fileCount || versionData.files?.length || 0,
                        });
                    } catch (err) {
                        // Fallback in case of parse errors
                        const vDate = new Date(project.createdAt).toISOString().split("T")[0];
                        generationsByDate[vDate] = (generationsByDate[vDate] || 0) + 1;
                    }
                }
            }
        }

        // Sort recent generations descending
        recentGenerationsList.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Sort timelines chronologically
        const sortedTimeline = Object.keys({ ...projectsByDate, ...generationsByDate })
            .sort()
            .map((date) => ({
                date,
                projects: projectsByDate[date] || 0,
                generations: generationsByDate[date] || 0,
            }));

        const creditsUsed = credits.total - (credits.remaining === -1 ? 0 : credits.remaining);

        return c.json({
            stats: {
                totalProjects,
                totalGenerations,
                creditsRemaining: credits.remaining,
                creditsTotal: credits.total,
                creditsUsed,
                plan: credits.plan,
            },
            modelUsage,
            timeline: sortedTimeline,
            recentGenerations: recentGenerationsList.slice(0, 10),
            projects: validProjects.map((p) => ({
                id: p.id,
                name: p.name,
                model: p.model,
                versionCount: p.currentVersion + 1,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            })),
        });
    } catch (error: any) {
        return c.json({
            error: "Failed to load analytics data: " + error.message,
            code: "ANALYTICS_FAILED",
        }, 500);
    }
});

export { analyticsRoutes };
