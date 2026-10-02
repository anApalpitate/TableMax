interface Blocker {
  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number;
  stop(id: number): boolean;
}
export class RuntimeGuard {
  private serviceBlocker: number | null = null;
  private displayBlocker: number | null = null;
  constructor(private blocker: Blocker) {}
  start() {
    this.serviceBlocker ??= this.blocker.start('prevent-app-suspension');
  }
  publicScreenVisible(visible: boolean) {
    if (visible)
      this.displayBlocker ??= this.blocker.start('prevent-display-sleep');
    else if (this.displayBlocker !== null) {
      this.blocker.stop(this.displayBlocker);
      this.displayBlocker = null;
    }
  }
  stop() {
    this.publicScreenVisible(false);
    if (this.serviceBlocker !== null) {
      this.blocker.stop(this.serviceBlocker);
      this.serviceBlocker = null;
    }
  }
}
