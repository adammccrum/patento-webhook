/**
 * Analytics Service
 *
 * Logs learner interactions with zero UI impact.
 * Every event must answer a product question.
 */

interface AnalyticsEvent {
  eventType: string;
  sessionId: string;
  userId: string;
  goalId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ConfidenceCapture {
  sessionId: string;
  userId: string;
  timestamp: string;
  confidenceLevel: number; // 0-1
  context: 'before_session' | 'after_reflection' | 'during_build';
}

class AnalyticsClient {
  private sessionId: string;
  private userId: string | null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = null;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize analytics for a user
   */
  setUser(userId: string): void {
    this.userId = userId;
  }

  /**
   * Log: Learner opened the app and is about to start discover
   */
  logSessionStarted(userId: string, confidenceBefore: number): void {
    this.userId = userId;
    this.logEvent({
      eventType: 'session_started',
      sessionId: this.sessionId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {
        confidenceBefore,
        ttftStartTime: Date.now(),
      },
    });
  }

  /**
   * Log: Learner described their problem on the Discover page
   */
  logDiscoverCompleted(userId: string, problem: string, goalId: string): void {
    this.logEvent({
      eventType: 'discover_completed',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        problemLength: problem.length,
      },
    });
  }

  /**
   * Log: Learner viewed the solution plan
   */
  logPersonalPlanViewed(userId: string, goalId: string): void {
    this.logEvent({
      eventType: 'personal_plan_viewed',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Log: Learner started the build session (clicked "Build It Now")
   */
  logBuildSessionStarted(userId: string, goalId: string): void {
    this.logEvent({
      eventType: 'build_session_started',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        buildStartTime: Date.now(),
      },
    });
  }

  /**
   * Log: Learner completed a build step
   */
  logBuildStepCompleted(userId: string, goalId: string, step: number, input: string): void {
    this.logEvent({
      eventType: 'build_step_completed',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        step,
        inputLength: input.length,
      },
    });
  }

  /**
   * Log: Learner finished building and the asset was created
   */
  logAssetCreated(userId: string, goalId: string, missionId: string): void {
    this.logEvent({
      eventType: 'asset_created',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        missionId,
        buildCompletionTime: Date.now(),
      },
    });
  }

  /**
   * Log: Learner submitted reflection with confidence
   * This marks Time to First Transformation (TTFT)
   */
  logReflectionSubmitted(
    userId: string,
    goalId: string,
    reflection: string,
    confidenceAfter: number
  ): void {
    this.logEvent({
      eventType: 'reflection_submitted',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        reflectionLength: reflection.length,
        confidenceAfter,
        ttftEndTime: Date.now(),
        // Check if learner expressed confidence in reflection
        hasConfidenceLanguage: this.detectConfidenceLanguage(reflection),
      },
    });
  }

  /**
   * Log: Session completed (learner clicked celebrate/dashboard)
   */
  logSessionCompleted(userId: string, goalId: string, willReturnTomorrow: boolean): void {
    this.logEvent({
      eventType: 'session_completed',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        willReturnTomorrow,
      },
    });
  }

  /**
   * Log: Learner paused for >5 seconds without interaction
   * Used for friction detection
   */
  logPause(userId: string, goalId: string, page: string, durationSeconds: number): void {
    this.logEvent({
      eventType: 'pause_detected',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        page,
        durationSeconds,
      },
    });
  }

  /**
   * Log: Learner closed page or navigated away unexpectedly
   */
  logAbandon(userId: string, goalId: string, page: string, lastStep: string): void {
    this.logEvent({
      eventType: 'abandon',
      sessionId: this.sessionId,
      userId,
      goalId,
      timestamp: new Date().toISOString(),
      metadata: {
        page,
        lastStep,
      },
    });
  }

  /**
   * Detect if reflection contains confidence-indicating language
   * This helps identify when learner feels capable (TTC signal)
   */
  private detectConfidenceLanguage(text: string): boolean {
    const confidenceIndicators = [
      'surprised',
      'easier',
      'quick',
      'simple',
      'easy',
      'actually works',
      'can use',
      'can build',
      'possible',
      'now i see',
      'didnt expect',
    ];

    const lowerText = text.toLowerCase();
    return confidenceIndicators.some((indicator) => lowerText.includes(indicator));
  }

  /**
   * Record learner returning to the app within 24h
   */
  logReturn24h(userId: string): void {
    this.logEvent({
      eventType: 'return_24h',
      sessionId: this.sessionId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Record learner returning within 7 days
   */
  logReturn7d(userId: string): void {
    this.logEvent({
      eventType: 'return_7d',
      sessionId: this.sessionId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Send event to backend
   */
  private async logEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (err) {
      // Silently fail - never interrupt learner experience for analytics
      console.debug('Analytics event failed silently:', err);
    }
  }

  /**
   * Get current session ID (for dashboard correlation)
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
let analyticsInstance: AnalyticsClient | null = null;

export function getAnalytics(): AnalyticsClient {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsClient();
  }
  return analyticsInstance;
}

export type { AnalyticsEvent, ConfidenceCapture };
