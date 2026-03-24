import { Injectable, Logger } from '@nestjs/common';

const MAX_EXECUTIONS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Tracks per-automation-per-contact execution counts within a rolling window
 * to detect and break infinite automation loops.
 */
@Injectable()
export class AutomationExecutionTracker {
  private readonly logger = new Logger(AutomationExecutionTracker.name);
  private readonly executionMap = new Map<string, number>();

  /**
   * Record an execution attempt. Returns false and logs a warning if the
   * maximum execution count for this automation+contact pair is exceeded.
   */
  trackExecution(automationId: string, contactId: string): boolean {
    const key = `${automationId}:${contactId}`;
    const count = this.executionMap.get(key) ?? 0;

    if (count >= MAX_EXECUTIONS) {
      this.logger.warn(
        `Automation loop detected — automationId=${automationId} contactId=${contactId} ` +
          `exceeded ${MAX_EXECUTIONS} executions within the last hour. Blocking further runs.`,
      );
      return false; // caller should abort execution
    }

    this.executionMap.set(key, count + 1);

    // Auto-clear after the window expires so counts don't persist indefinitely
    setTimeout(() => {
      const current = this.executionMap.get(key);
      if (current && current <= 1) {
        this.executionMap.delete(key);
      } else if (current) {
        this.executionMap.set(key, current - 1);
      }
    }, WINDOW_MS);

    return true;
  }

  /** Expose current count for monitoring/testing. */
  getCount(automationId: string, contactId: string): number {
    return this.executionMap.get(`${automationId}:${contactId}`) ?? 0;
  }

  /** Reset a specific key (e.g., after admin intervention). */
  reset(automationId: string, contactId: string): void {
    this.executionMap.delete(`${automationId}:${contactId}`);
  }
}
