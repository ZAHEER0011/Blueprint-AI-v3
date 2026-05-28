/**
 * worker/src/routes/credits.ts
 *
 * Credits endpoints for the editor.
 * Returns the user's current credit balance and plan info.
 *
 * Endpoints:
 *   GET /api/credits - Get current user's credits
 */

import { Hono } from "hono";
import { AppVariables, Env } from "../types";
import { getCredits } from "../services/credits";

const creditsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * GET /api/credits
 * Returns the authenticated user's credit balance and plan info.
 * Used by the editor to show remaining credits and enforce limits.
 */
creditsRoutes.get("/", async (c) => {
    const userId = c.var.userId;

    const credits = await getCredits(userId, c.env);

    return c.json({
        remaining: credits.remaining,
        total: credits.total,
        plan: credits.plan,
        periodStart: credits.periodStart,
        periodEnd: credits.periodEnd,
    });
});



export { creditsRoutes };