"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    CORS_ORIGIN: zod_1.z.string().default("http://localhost:5173"),
    DB_HOST: zod_1.z.string(),
    DB_PORT: zod_1.z.coerce.number().default(3306),
    DB_NAME: zod_1.z.string(),
    DB_USER: zod_1.z.string(),
    DB_PASSWORD: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string().min(20),
    JWT_REFRESH_SECRET: zod_1.z.string().min(20),
    JWT_EXPIRES_IN: zod_1.z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default("7d"),
    FRONTEND_URL: zod_1.z.string().default("http://localhost:8080"),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    SMTP_FROM: zod_1.z.string().optional(),
    SMTP_SECURE: zod_1.z.coerce.boolean().optional(),
    SUPPORT_EMAIL: zod_1.z.string().email().default("campustutorgh@gmail.com"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}
exports.env = parsed.data;
