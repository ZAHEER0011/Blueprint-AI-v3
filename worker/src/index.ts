import { Hono } from 'hono'
import { cors } from "hono/cors"
import { Env, AppVariables } from './types'
import { authMiddleware } from './middleware/auth';
import { projectRoutes } from './routes/project';
import { chatRoutes } from './routes/chat';
import { creditsRoutes } from './routes/credits';
import { versionRoutes } from './routes/versions';
import { settingsRoutes } from './routes/settings';
import { analyticsRoutes } from './routes/analytics';


const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

app.use(
    "/*",
    cors({
        origin: (origin) => origin || "http://localhost:3000",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: 600,
        credentials: true,
    })
)

app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/api/*", authMiddleware)


app.route("/api/projects", projectRoutes)

app.route("/api/chat", chatRoutes)

app.route("/api/credits", creditsRoutes)

app.route("/api/projects", versionRoutes)

app.route("/api/settings", settingsRoutes)

app.route("/api/analytics", analyticsRoutes)

export default app;