import { describe, it, expect, beforeEach } from "vitest";
import { FakeClock, SystemClock } from "../../src/lib/clock.js";

describe("FakeClock", () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("returns the initial time", () => {
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("advance() moves time forward by ms", () => {
    clock.advance(5000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:05.000Z");
  });

  it("advanceSeconds() works", () => {
    clock.advanceSeconds(30);
    expect(clock.now().getUTCSeconds()).toBe(30);
  });

  it("advanceMinutes() works", () => {
    clock.advanceMinutes(30);
    expect(clock.now().getUTCMinutes()).toBe(30);
  });

  it("advanceHours() works", () => {
    clock.advanceHours(8);
    expect(clock.now().getUTCHours()).toBe(8);
  });

  it("advanceDays() works", () => {
    clock.advanceDays(7);
    expect(clock.now().toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("setTime() sets absolute time", () => {
    const target = new Date("2026-06-15T12:00:00.000Z");
    clock.setTime(target);
    expect(clock.now().toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });

  it("now() returns a new Date instance each call", () => {
    const a = clock.now();
    const b = clock.now();
    expect(a).not.toBe(b);
    expect(a.getTime()).toBe(b.getTime());
  });

  it("does not mutate returned date when advancing", () => {
    const before = clock.now();
    clock.advance(1000);
    const after = clock.now();
    expect(before.getTime() + 1000).toBe(after.getTime());
    // before should still be the old time
    expect(before.getTime()).not.toBe(after.getTime());
  });
});

describe("SystemClock", () => {
  it("returns approximately current time", () => {
    const sc = new SystemClock();
    const before = Date.now();
    const now = sc.now().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

