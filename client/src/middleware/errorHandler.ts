import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";

export interface AppError extends Error {
	statusCode?: number;
	isOperational?: boolean;
}

export const errorHandler = (
	error: AppError,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const statusCode = error.statusCode || 500;
	const isOperational = error.isOperational || false;

	logger.error("Error occurred", {
		error: error.message,
		stack: error.stack,
		statusCode,
		isOperational,
		url: req.url,
		method: req.method,
		ip: req.ip,
	});

	// Don't leak error details in production
	const message =
		process.env.NODE_ENV === "production" && !isOperational
			? "Internal Server Error"
			: error.message;

	res.status(statusCode).json({
		error: {
			message,
			statusCode,
			timestamp: new Date().toISOString(),
			path: req.url,
			method: req.method,
		},
	});
};

export const createError = (
	message: string,
	statusCode: number = 500
): AppError => {
	const error = new Error(message) as AppError;
	error.statusCode = statusCode;
	error.isOperational = true;
	return error;
};

export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};
