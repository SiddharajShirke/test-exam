/**
 * Clock abstraction so business logic never calls Date.now() directly.
 * Tests inject FakeClock to control time precisely.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FakeClock implements Clock {
  private _current: Date;

  constructor(initial?: Date) {
    this._current = initial ?? new Date();
  }

  now(): Date {
    return new Date(this._current);
  }

  setTime(date: Date): void {
    this._current = new Date(date);
  }

  advance(ms: number): void {
    this._current = new Date(this._current.getTime() + ms);
  }

  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  advanceDays(days: number): void {
    this.advance(days * 24 * 60 * 60 * 1000);
  }
}

