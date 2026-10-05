import { describe, expect, it } from "vitest";
import { parseOpenIntent } from "../openIntent";
import { inviteUrl, parseInvite } from "../social";

describe("pozvánky", () => {
  it("odkaz nese přezdívku a zpátky se z něj přečte", () => {
    const url = inviteUrl("jana_k", "https://miligram-app.pages.dev");
    expect(url).toBe("https://miligram-app.pages.dev/?pritel=jana_k");
    expect(parseInvite(url)).toBe("jana_k");
  });

  it("pozvánka ze schránky může být věta s odkazem i holá přezdívka", () => {
    expect(parseInvite("Počítej se mnou https://miligram-app.pages.dev/?pritel=Petr_M")).toBe("petr_m");
    expect(parseInvite("  eva  ")).toBe("eva");
    expect(parseInvite("ahoj, jak se máš")).toBeNull();
    expect(parseInvite("ab")).toBeNull();
  });

  it("adresa aplikace otevře pozvánku, souboje i ligu", () => {
    expect(parseOpenIntent("https://x.cz/?pritel=jana_k")).toBe("invite:jana_k");
    expect(parseOpenIntent("https://x.cz/?pritel=<script>")).toBeNull();
    expect(parseOpenIntent("https://x.cz/?open=duels")).toBe("duels");
    expect(parseOpenIntent("https://x.cz/?open=league")).toBe("league");
    expect(parseOpenIntent("https://x.cz/?open=account")).toBe("account");
    expect(parseOpenIntent("https://x.cz/?lesson=daily")).toBe("lesson");
  });

  it("notifikace o souboji otevře jeho kartu", () => {
    const id = "0b5c3a1e-7d2f-4c8a-9e61-3f2d1c0b9a87";
    expect(parseOpenIntent(`https://x.cz/?open=duels&duel=${id}`)).toBe(`duel:${id}`);
    // Cokoli jiného než identifikátor souboje se přejde, zbude seznam.
    expect(parseOpenIntent("https://x.cz/?open=duels&duel=<script>")).toBe("duels");
  });
});
