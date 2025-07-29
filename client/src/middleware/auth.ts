import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "@/config";
import { logger } from "@/utils/logger";
import { createError } from "./errorHandler";

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		role: string;
	};
}

export const authMiddleware = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): void => {
	try {
		// Check for API key first
		const apiKey = req.header("X-API-Key");
		if (apiKey === config.security.apiKey) {
			logger.debug("API key authentication successful");
			return next();
		}

		// Check for JWT token
		const authHeader = req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return next(createError("No token provided", 401));
		}

		const token = authHeader.substring(7); // Remove 'Bearer ' prefix

		try {
			const decoded = jwt.verify(token, config.security.jwtSecret) as any;
			req.user = {
				id: decoded.id,
				role: decoded.role || "user",
			};

			logger.debug("JWT authentication successful", {
				userId: req.user.id,
				role: req.user.role,
			});

			next();
		} catch (jwtError) {
			logger.warn("JWT verification failed", {
				error:
					jwtError instanceof Error
						? jwtError.message
						: "Unknown error",
				token: token.substring(0, 20) + "...",
			});
			return next(createError("Invalid token", 401));
		}
	} catch (error) {
		logger.error("Authentication middleware error", error);
		next(createError("Authentication error", 500));
	}
};

export const generateToken = (payload: object): string => {
	return jwt.sign(payload, config.security.jwtSecret, {
		expiresIn: "24h",
	});
};

export const verifyToken = (token: string): any => {
	return jwt.verify(token, config.security.jwtSecret);
};
