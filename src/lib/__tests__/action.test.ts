import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionTimeoutError, withTimeout } from "../useAction";

describe("časový limit akce", () => {
  afterEach(() => vi.useRealTimers());

  it("visící akce po limitu spadne, místo aby čekala donekonečna", async () => {
    vi.useFakeTimers();
    const hanging = new Promise<never>(() => {});
    const result = withTimeout(hanging, 1000);
    vi.advanceTimersByTime(1000);
    await expect(result).rejects.toBeInstanceOf(ActionTimeoutError);
  });

  it("včasná akce vrátí svůj výsledek i svou chybu", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(new Error("síť")), 1000)).rejects.toThrow("síť");
  });
});
