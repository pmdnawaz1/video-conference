import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface Config {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    sslMode: string;
    maxConnections: number;
    maxIdleConnections: number;
    maxLifetimeMinutes: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    origin: string;
    allowedOrigins: string[];
  };
  webrtc: {
    stunServers: string[];
    turnServers: string[];
  };
  logging: {
    level: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    };
    templates: {
      path: string;
    };
  };
  calendar: {
    google: {
      serviceAccountKey?: string;
      calendarId: string;
    };
  };
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || "8081", 10),
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://localhost:5432/video_conference",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "video_conference",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
    sslMode: process.env.DB_SSLMODE || "prefer",
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "25", 10),
    maxIdleConnections: parseInt(
      process.env.DB_MAX_IDLE_CONNECTIONS || "10",
      10,
    ),
    maxLifetimeMinutes: parseInt(
      process.env.DB_MAX_LIFETIME_MINUTES || "60",
      10,
    ),
  },
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ],
  },
  webrtc: {
    stunServers: process.env.STUN_SERVERS?.split(",") || [
      "stun:stun.l.google.com:19302",
    ],
    turnServers: process.env.TURN_SERVERS?.split(",") || [],
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "9000000000", 10), // 15 minutes
    maxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || "10000000000",
      10,
    ),
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    },
    templates: {
      path: process.env.EMAIL_TEMPLATES_PATH || "src/templates/email",
    },
  },
  calendar: {
    google: {
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    },
  },
};

export default config;
