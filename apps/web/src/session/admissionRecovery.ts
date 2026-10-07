export const ADMISSION_TIMEOUT = 8000;
type Attempt = {
  controller: AbortController;
  startedAt: number;
  epoch: number;
};

// Browser wake events can precede the timeout task that was frozen in the
// background. Queue one recovery, and make identity changes invalidate replies.
export class AdmissionRecovery {
  private epoch = 0;
  private active: Attempt | null = null;
  private recoverAfterActive = false;

  constructor(private readonly now = () => Date.now()) {}

  begin(): Attempt | null {
    if (this.active) return null;
    const attempt = {
      controller: new AbortController(),
      startedAt: this.now(),
      epoch: this.epoch,
    };
    this.active = attempt;
    return attempt;
  }

  isCurrent(attempt: Attempt) {
    return this.active === attempt && attempt.epoch === this.epoch;
  }

  recover() {
    if (!this.active) return true;
    this.recoverAfterActive = true;
    if (this.now() - this.active.startedAt >= ADMISSION_TIMEOUT)
      this.active.controller.abort();
    return false;
  }

  finish(attempt: Attempt) {
    if (!this.isCurrent(attempt)) return { current: false, recover: false };
    this.active = null;
    const recover = this.recoverAfterActive;
    this.recoverAfterActive = false;
    return { current: true, recover };
  }

  cancel() {
    this.epoch++;
    this.active?.controller.abort();
    this.active = null;
    this.recoverAfterActive = false;
  }
}
