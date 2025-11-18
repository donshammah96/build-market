import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  userId?: string;
}

/**
 * Middleware to verify JWT token from NextAuth
 * Expects Authorization header with Bearer token
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized - No token provided",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token using NextAuth's JWT secret
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, secret) as {
      sub?: string;
      email?: string;
      role?: string;
    };

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized - Invalid token",
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    req.userId = decoded.sub;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      error: "Unauthorized - Token verification failed",
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that can work with or without auth
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
      
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as {
            sub?: string;
            email?: string;
            role?: string;
          };

          if (decoded && decoded.sub) {
            req.user = {
              id: decoded.sub,
              email: decoded.email,
              role: decoded.role,
            };
            req.userId = decoded.sub;
          }
        } catch (error) {
          // Invalid token, continue without auth
        }
      }
    }

    next();
  } catch (error) {
    // Continue without auth if token verification fails
    next();
  }
}

/**
 * Middleware to check if user is authorized to access a conversation
 */
export function checkConversationAccess(
  participantUserIdKey: string = "userId"
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const targetUserId = req.params[participantUserIdKey] || req.body[participantUserIdKey];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // User can only access their own conversations
    if (targetUserId && userId !== targetUserId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - Cannot access other users' conversations",
      });
    }

    next();
  };
}

