/**
 * Centralized logging utility with different log levels
 * Can be extended to send logs to external services (e.g., Sentry, Firebase Crashlytics)
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    data?: any;
    timestamp: number;
}

class Logger {
    private static instance: Logger;
    private logHistory: LogEntry[] = [];
    private maxHistorySize = 100;
    private enableConsoleLog = true;
    private enableHistoryLog = true;

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private log(level: LogLevel, message: string, context?: string, data?: any): void {
        const entry: LogEntry = {
            level,
            message,
            context,
            data,
            timestamp: Date.now(),
        };

        // Add to history
        if (this.enableHistoryLog) {
            this.logHistory.push(entry);
            if (this.logHistory.length > this.maxHistorySize) {
                this.logHistory.shift();
            }
        }

        // Console output
        if (this.enableConsoleLog) {
            const prefix = context ? `[${context}]` : '';
            const timestamp = new Date(entry.timestamp).toISOString();

            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(`${timestamp} ${prefix} ${message}`, data || '');
                    break;
                case LogLevel.INFO:
                    console.log(`${timestamp} ${prefix} ${message}`, data || '');
                    break;
                case LogLevel.WARN:
                    console.warn(`${timestamp} ${prefix} ${message}`, data || '');
                    break;
                case LogLevel.ERROR:
                    console.error(`${timestamp} ${prefix} ${message}`, data || '');
                    break;
            }
        }

        // TODO: Send to external logging service in production
        // if (__DEV__ === false) {
        //   this.sendToExternalService(entry);
        // }
    }

    debug(message: string, context?: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, context, data);
    }

    info(message: string, context?: string, data?: any): void {
        this.log(LogLevel.INFO, message, context, data);
    }

    warn(message: string, context?: string, data?: any): void {
        this.log(LogLevel.WARN, message, context, data);
    }

    error(message: string, context?: string, data?: any): void {
        this.log(LogLevel.ERROR, message, context, data);
    }

    /**
     * Get recent log history
     * @param count Number of recent logs to retrieve
     * @returns Array of log entries
     */
    getRecentLogs(count: number = 50): LogEntry[] {
        return this.logHistory.slice(-count);
    }

    /**
     * Clear log history
     */
    clearHistory(): void {
        this.logHistory = [];
    }

    /**
     * Configure logger settings
     */
    configure(options: {
        enableConsoleLog?: boolean;
        enableHistoryLog?: boolean;
        maxHistorySize?: number;
    }): void {
        if (options.enableConsoleLog !== undefined) {
            this.enableConsoleLog = options.enableConsoleLog;
        }
        if (options.enableHistoryLog !== undefined) {
            this.enableHistoryLog = options.enableHistoryLog;
        }
        if (options.maxHistorySize !== undefined) {
            this.maxHistorySize = options.maxHistorySize;
        }
    }

    /**
     * TODO: Implement external logging service integration
     * @param entry Log entry to send
     */
    private async sendToExternalService(entry: LogEntry): Promise<void> {
        // Example: Send to Sentry, Firebase Crashlytics, or custom backend
        // try {
        //   await fetch('https://your-logging-service.com/log', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(entry),
        //   });
        // } catch (error) {
        //   // Silently fail to avoid infinite loops
        // }
    }
}

export default Logger.getInstance();
