import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { createMiddleware } from "hono/factory"
import type { Env, AppVariables } from "../types"

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSUrl: string | null = null;

async function getJWKS(jwksUrl: string) {
    if (cachedJWKS && cachedJWKSUrl === jwksUrl) {
        return cachedJWKS;
    }

    cachedJWKS = createRemoteJWKSet(new URL(jwksUrl), {
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
    })
    cachedJWKSUrl = jwksUrl;
    return cachedJWKS
}

export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AppVariables,
}>(async (c, next) => {
    const authHeader = c.req.header("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json(
            {
                error: "Missing or invalid Authorization header",
                code: ""
            },
            401
        )
    }
    const token = authHeader.slice(7)
    try {
        const jwks = await getJWKS(c.env.CLERK_JWKS_URL);

        const { payload } = await jwtVerify(token, jwks, {
            issuer: c.env.CLERK_ISSUER,
        })

        const userId = payload.sub as string;
        if (!userId) {
            return c.json(
                {
                    error: "Invalid token payload: missing sub claim",
                    code: "UNAUTHORIZED"
                },
                401
            )
        }
        c.set("userId", userId);
        await next()

    } catch (err) {
        const message = err instanceof Error ? err.message : "JWT verification failed";
        return c.json({
            error: message,
            code: "UNAUTHORIZED"
        }, 401)
    }

})