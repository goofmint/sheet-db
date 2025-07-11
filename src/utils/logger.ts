/**
 * Simple structured logging utility for Cloudflare Workers
 */

export interface LogContext {
	[key: string]: any;
}

export interface Logger {
	debug: (message: string, context?: LogContext) => void;
	info: (message: string, context?: LogContext) => void;
	warn: (message: string, context?: LogContext) => void;
	error: (message: string, context?: LogContext) => void;
}

function sanitizeContext(context: LogContext): LogContext {
	const sanitized: LogContext = {};
	for (const [key, value] of Object.entries(context)) {
		// Remove sensitive data from logs
		if (key.toLowerCase().includes('password') || 
			key.toLowerCase().includes('secret') || 
			key.toLowerCase().includes('token') ||
			key.toLowerCase().includes('key')) {
			sanitized[key] = '[REDACTED]';
		} else if (key === 'userId' || key === 'userRoles') {
			// Sanitize user info - only show if user exists, not the actual values
			sanitized[key] = value ? '[PRESENT]' : '[ABSENT]';
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

function log(level: string, message: string, context?: LogContext): void {
	const timestamp = new Date().toISOString();
	const logEntry = {
		timestamp,
		level,
		message,
		...(context ? { context: sanitizeContext(context) } : {})
	};

	// In production, you might want to send to a logging service
	// For now, we'll use console but with structured format
	console.log(JSON.stringify(logEntry));
}

export const logger: Logger = {
	debug: (message: string, context?: LogContext) => log('DEBUG', message, context),
	info: (message: string, context?: LogContext) => log('INFO', message, context),
	warn: (message: string, context?: LogContext) => log('WARN', message, context),
	error: (message: string, context?: LogContext) => log('ERROR', message, context)
};