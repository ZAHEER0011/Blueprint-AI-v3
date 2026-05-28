import { Hono } from "hono";
import { Env, AppVariables } from "../types";

const settingsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/settings/github
// Returns connected status and user profile details
settingsRoutes.get("/github", async (c) => {
    const userId = c.var.userId;
    const githubSettings = await c.env.METADATA.get<{
        token: string;
        username: string;
        avatarUrl: string;
        name: string;
    }>(`github:${userId}`, "json");

    if (!githubSettings) {
        return c.json({ connected: false });
    }

    return c.json({
        connected: true,
        username: githubSettings.username,
        avatarUrl: githubSettings.avatarUrl,
        name: githubSettings.name,
    });
});

// POST /api/settings/github
// Connects GitHub by validating token against GitHub API and saving to KV
settingsRoutes.post("/github", async (c) => {
    const userId = c.var.userId;
    const { token } = await c.req.json<{ token: string }>();

    if (!token) {
        return c.json({ error: "Token is required", code: "BAD_REQUEST" }, 400);
    }

    try {
        // Validate against GitHub API
        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `token ${token}`,
                "User-Agent": "Blueprint-AI-Backend",
                Accept: "application/vnd.github+json",
            },
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            return c.json({
                error: "Failed to validate GitHub token. Make sure it is valid and has correct scopes.",
                code: "GITHUB_VAL_FAILED",
                details: errBody,
            }, response.status as any);
        }

        const user = (await response.json()) as {
            login: string;
            avatar_url: string;
            name: string;
        };

        const githubSettings = {
            token,
            username: user.login,
            avatarUrl: user.avatar_url,
            name: user.name || user.login,
        };

        await c.env.METADATA.put(`github:${userId}`, JSON.stringify(githubSettings));

        return c.json({
            connected: true,
            username: githubSettings.username,
            avatarUrl: githubSettings.avatarUrl,
            name: githubSettings.name,
        });
    } catch (err: any) {
        return c.json({
            error: "Error validating GitHub token: " + err.message,
            code: "INTERNAL_ERROR",
        }, 500);
    }
});

// DELETE /api/settings/github
// Disconnects GitHub from the user's account
settingsRoutes.delete("/github", async (c) => {
    const userId = c.var.userId;
    await c.env.METADATA.delete(`github:${userId}`);
    return c.json({ success: true });
});

// GET /api/settings/github/token
// Returns raw token for client-side GitHub REST integrations (like pushing files)
settingsRoutes.get("/github/token", async (c) => {
    const userId = c.var.userId;
    const githubSettings = await c.env.METADATA.get<{
        token: string;
    }>(`github:${userId}`, "json");

    if (!githubSettings) {
        return c.json({ error: "GitHub not connected", code: "NOT_CONNECTED" }, 400);
    }

    return c.json({ token: githubSettings.token });
});

// POST /api/settings/github/oauth
// Receives standard authorization code from frontend redirect callback and exchanges it for access token
settingsRoutes.post("/github/oauth", async (c) => {
    const userId = c.var.userId;
    const { code } = await c.req.json<{ code: string }>();

    if (!code) {
        return c.json({ error: "Code is required", code: "BAD_REQUEST" }, 400);
    }

    const clientId = c.env.GITHUB_CLIENT_ID;
    const clientSecret = c.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return c.json({
            error: "GitHub OAuth credentials are not configured on the server. Please configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .dev.vars (local dev) or wrangler secrets (production).",
            code: "OAUTH_NOT_CONFIGURED",
        }, 500);
    }

    try {
        // Exchange code for token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
            }),
        });

        if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            return c.json({
                error: "Failed to exchange authorization code for access token: " + errText,
                code: "TOKEN_EXCHANGE_FAILED",
            }, 500);
        }

        const tokenData = (await tokenResponse.json()) as {
            access_token?: string;
            error?: string;
            error_description?: string;
        };

        if (tokenData.error || !tokenData.access_token) {
            return c.json({
                error: tokenData.error_description || tokenData.error || "Token exchange did not return an access token.",
                code: "TOKEN_EXCHANGE_ERROR",
            }, 400);
        }

        const token = tokenData.access_token;

        // Fetch User Info
        const userResponse = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `token ${token}`,
                "User-Agent": "Blueprint-AI-Backend",
                Accept: "application/vnd.github+json",
            },
        });

        if (!userResponse.ok) {
            return c.json({
                error: "Failed to retrieve user details from GitHub.",
                code: "USER_FETCH_FAILED",
            }, 500);
        }

        const user = (await userResponse.json()) as {
            login: string;
            avatar_url: string;
            name: string;
        };

        const githubSettings = {
            token,
            username: user.login,
            avatarUrl: user.avatar_url,
            name: user.name || user.login,
        };

        await c.env.METADATA.put(`github:${userId}`, JSON.stringify(githubSettings));

        return c.json({
            connected: true,
            username: githubSettings.username,
            avatarUrl: githubSettings.avatarUrl,
            name: githubSettings.name,
        });
    } catch (err: any) {
        return c.json({
            error: "OAuth flow failed: " + err.message,
            code: "INTERNAL_ERROR",
        }, 500);
    }
});

export { settingsRoutes };
