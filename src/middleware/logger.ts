import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Enable/disable logging with this flag
export const ENABLE_LOGGING = false;

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Capture the response
    const originalSend = res.send;
    res.send = function (body: any) {
        const duration = Date.now() - startTime;
        if (ENABLE_LOGGING) {
            // Detailed logging
            const requestId = crypto.randomBytes(3).toString('hex');
            console.log(`[${requestId}] ${new Date().toISOString()} REQUEST: {
  method: '${req.method}',
  url: '${req.url}',
  auth: ${req.cookies.auth_token ? 'present' : 'none'},
  query: ${JSON.stringify(req.query)}
}`);
            console.log(`[${requestId}] ${new Date().toISOString()} RESPONSE: {
  statusCode: ${res.statusCode},
  duration: '${duration}ms'
}`);
            console.log('--------------------------------------------------------------------------------');
        } else {
            // Basic logging
            console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
        }
        return originalSend.call(this, body);
    };

    next();
}