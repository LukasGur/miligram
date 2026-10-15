import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUSH_ENDPOINT, isPushEndpoint, withTimeout } from "../../../supabase/functions/push/endpoint.ts";

/**
 * Pošťák smí posílat jen na známé push služby (migrace 0019). Vzor stojí
 * v databázi i v Edge Function a musí být stejný.
 */
describe("adresy push služeb", () => {
  it("pustí skutečné adresy prohlížečů", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://web.push.apple.com/QGx2",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ]) {
      expect(isPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("odmítne cokoli jiného", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/fcm/send/x",
      "https://fcm.googleapis.com@evil.example/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilpush.apple.com.example/x",
      "https://10.0.0.5/admin",
      "https://example.com/push.apple.com/",
      "https://fcm.googleapis.com",
    ]) {
      expect(isPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  it("migrace 0019 má tentýž vzor", () => {
    const sql = readFileSync("supabase/migrations/0019_bezpecnost.sql", "utf8");
    expect(sql).toContain(`select endpoint ~ '${PUSH_ENDPOINT.source.replaceAll("\\/", "/")}';`);
  });

  it("odeslání, které neodpoví, skončí po limitu", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("timeout");
    await expect(withTimeout(Promise.resolve("ok"), 10)).resolves.toBe("ok");
  });
});
