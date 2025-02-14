import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Enable/disable logging with this flag
export const ENABLE_LOGGING = false;

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!ENABLE_LOGGING) {
        return next();
    }

    const requestId = crypto.randomBytes(3).toString('hex');
    const startTime = Date.now();

    // Log the request
    console.log(`[${requestId}] ${new Date().toISOString()} REQUEST: {
  method: '${req.method}',
  url: '${req.url}',
  auth: ${req.cookies.auth_token ? 'present' : 'none'},
  query: ${JSON.stringify(req.query)}
}`);

    // Capture the response
    const originalSend = res.send;
    res.send = function (body: any) {
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] ${new Date().toISOString()} RESPONSE: {
  statusCode: ${res.statusCode},
  duration: '${duration}ms'
}`);
        console.log('--------------------------------------------------------------------------------');
        return originalSend.call(this, body);
    };

    next();
} 