import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Validation middleware for REST API endpoints
 */

// UUID validation schema
const uuidSchema = z.string().uuid("Invalid UUID format");

// Room creation validation
export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, "Room name is required")
    .max(100, "Room name must be less than 100 characters")
    .optional(),
  maxParticipants: z
    .number()
    .int("Max participants must be an integer")
    .min(2, "Room must allow at least 2 participants")
    .max(1000, "Room cannot exceed 1000 participants")
    .optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  isPrivate: z.boolean().optional(),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

// Room update validation
export const updateRoomSchema = z.object({
  name: z
    .string()
    .min(1, "Room name cannot be empty")
    .max(100, "Room name must be less than 100 characters")
    .optional(),
  maxParticipants: z
    .number()
    .int("Max participants must be an integer")
    .min(2, "Room must allow at least 2 participants")
    .max(1000, "Room cannot exceed 1000 participants")
    .optional(),
  isLocked: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

// Join room validation
export const joinRoomSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  meetingId: z.string().uuid("Invalid meeting ID format").optional(),
  isModerator: z.boolean().optional(),
  password: z.string().optional(),
});

// Leave room validation
export const leaveRoomSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
});

// Query parameter validation
export const roomQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
  page: z.string().regex(/^\d+$/, "Page must be a positive integer").optional(),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "Limit must be a positive integer")
    .optional(),
  sortBy: z
    .enum(["name", "createdAt", "updatedAt", "currentParticipants"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

/**
 * Generic validation middleware factory
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid request data",
          details: result.error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      req.body = result.data;
      next();
    } catch (error) {
      console.error("Validation middleware error:", error);
      res.status(500).json({
        error: "Internal validation error",
        message: "Failed to validate request data",
      });
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          message: "Query parameters validation failed",
          details: result.error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      req.query = result.data as any;
      next();
    } catch (error) {
      console.error("Query validation error:", error);
      res.status(500).json({
        error: "Internal validation error",
        message: "Failed to validate query parameters",
      });
    }
  };
}

/**
 * Validate URL parameters (like roomId, userId)
 */
export function validateParams(
  paramName: string,
  schema: z.ZodSchema = uuidSchema,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramValue = req.params[paramName];
      const result = schema.safeParse(paramValue);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid parameter",
          message: `Invalid ${paramName}`,
          details: result.error.issues.map((err: z.ZodIssue) => ({
            field: paramName,
            message: err.message,
          })),
        });
      }

      next();
    } catch (error) {
      console.error("Parameter validation error:", error);
      res.status(500).json({
        error: "Internal validation error",
        message: "Failed to validate parameters",
      });
    }
  };
}

/**
 * Global error handler for validation errors
 */
export function handleValidationErrors(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation error",
      message: "Request validation failed",
      details: error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }

  next(error);
}

/**
 * Sanitize input data
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Basic HTML tag stripping for string fields
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === "string") {
      return obj.replace(/<[^>]*>/g, "").trim();
    }
    if (typeof obj === "object" && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  next();
}

/**
 * Rate limiting per endpoint type
 */
export function createRateLimiter(
  windowMs: number = 15 * 60 * 1000,
  maxRequests: number = 100,
) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();

    // Clean up expired entries
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(ip);
      }
    }

    const clientData = requests.get(clientIP) || {
      count: 0,
      resetTime: now + windowMs,
    };

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
    } else {
      clientData.count++;
    }

    requests.set(clientIP, clientData);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - clientData.count),
    );
    res.setHeader("X-RateLimit-Reset", Math.ceil(clientData.resetTime / 1000));

    if (clientData.count > maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Try again after ${Math.ceil((clientData.resetTime - now) / 1000)} seconds`,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
    }

    next();
  };
}

export default {
  validateBody,
  validateQuery,
  validateParams,
  handleValidationErrors,
  sanitizeInput,
  createRateLimiter,
  createRoomSchema,
  updateRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  roomQuerySchema,
};
