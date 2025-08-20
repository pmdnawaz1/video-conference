import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { authService } from "../services/authService";
import { AuthenticatedRequest } from "../types";

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Also check for token in query params (for WebSocket upgrade)
  if (req.query.token && typeof req.query.token === "string") {
    return req.query.token;
  }

  return null;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
      message: "No token provided",
    });
  }

  authService
    .verifyAccessToken(token)
    .then((payload) => {
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        clientId: payload.clientId,
      };
      next();
    })
    .catch((error) => {
      res.status(401).json({
        error: "Invalid token",
        message: error.message,
      });
    });
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);

  if (!token) {
    return next(); // Continue without authentication
  }

  authService
    .verifyAccessToken(token)
    .then((payload) => {
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        clientId: payload.clientId,
      };
      next();
    })
    .catch((error) => {
      // Continue without authentication even if token is invalid
      next();
    });
}

/**
 * Authorization middleware factory
 * Creates middleware that checks for required role
 */
export function authorize(requiredRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated",
      });
    }

    if (!authService.hasRole(req.user.role as UserRole, requiredRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `Required role: ${requiredRole}, current role: ${req.user.role}`,
      });
    }

    next();
  };
}

/**
 * Client authorization middleware
 * Ensures user belongs to the specified client
 */
export function authorizeClient(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      message: "User not authenticated",
    });
  }

  const clientId =
    req.params.clientId || req.body.clientId || req.query.clientId;

  if (!clientId) {
    return res.status(400).json({
      error: "Client ID required",
      message: "No client ID provided",
    });
  }

  if (req.user.clientId !== clientId) {
    // Allow super admins to access any client
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        error: "Access denied",
        message: "User does not belong to this client",
      });
    }
  }

  next();
}

/**
 * Resource ownership middleware
 * Ensures user owns the resource or has sufficient permissions
 */
export function authorizeOwnership(resourceUserIdField: string = "userId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated",
      });
    }

    const resourceUserId =
      req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        error: "Resource owner not specified",
        message: `No ${resourceUserIdField} provided`,
      });
    }

    // Allow access if user owns the resource
    if (req.user.id === resourceUserId) {
      return next();
    }

    // Allow admins and super admins to access any resource within their client
    if (authService.hasRole(req.user.role as UserRole, UserRole.ADMIN)) {
      // For admins, check they belong to the same client as the resource owner
      // This would require a database lookup in a real implementation
      return next();
    }

    return res.status(403).json({
      error: "Access denied",
      message: "You can only access your own resources",
    });
  };
}

/**
 * Rate limiting middleware (simple implementation)
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();

    if (!rateLimitStore[key] || now > rateLimitStore[key].resetTime) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
    } else {
      rateLimitStore[key].count++;
    }

    if (rateLimitStore[key].count > options.maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        message: options.message || "Rate limit exceeded",
        retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000),
      });
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, options.maxRequests - rateLimitStore[key].count),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(rateLimitStore[key].resetTime / 1000),
    );

    next();
  };
}

/**
 * CORS preflight handler for authenticated routes
 */
export function handleCorsAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(200).end();
  }
  next();
}

/**
 * Security headers middleware
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Remove powered-by header
  res.removeHeader("X-Powered-By");

  next();
}

/**
 * Request logging middleware for authenticated routes
 */
export function logAuthenticatedRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const user = req.user;
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip;

  if (user) {
    console.log(
      `🔐 [${method}] ${url} - User: ${user.email} (${user.role}) - IP: ${ip}`,
    );
  } else {
    console.log(`🔓 [${method}] ${url} - Anonymous - IP: ${ip}`);
  }

  next();
}

/**
 * Error handling middleware for auth-related errors
 */
export function handleAuthErrors(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Invalid token",
      message: "Token is malformed",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Token expired",
      message: "Token has expired, please refresh",
    });
  }

  if (err.message.includes("credentials") || err.message.includes("password")) {
    return res.status(401).json({
      error: "Authentication failed",
      message: "Invalid credentials",
    });
  }

  next(err);
}
