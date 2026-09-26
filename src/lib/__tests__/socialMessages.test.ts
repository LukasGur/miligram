import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import cs from "../../../messages/cs.json";
import sk from "../../../messages/sk.json";
import { BADGES } from "@/core/badges";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`),
  );
}

describe("texty sociální vrstvy", () => {
  it("čeština a slovenština mají stejné klíče", () => {
    expect(leaves(sk.social as Tree).map(([key]) => key).sort()).toEqual(
      leaves(cs.social as Tree).map(([key]) => key).sort(),
    );
  });

  it("každý text jde rozebrat jako ICU zpráva", () => {
    for (const [locale, messages] of [["cs", cs], ["sk", sk]] as const) {
      for (const [key, value] of leaves(messages.social as Tree)) {
        expect(() => new IntlMessageFormat(value, locale), `${locale}/${key}`).not.toThrow();
      }
    }
  });

  it("každý odznak má jméno a pravidlo", () => {
    for (const badge of BADGES) {
      expect(cs.social.badge[badge.id].name).toBeTruthy();
      expect(sk.social.badge[badge.id].rule).toBeTruthy();
    }
  });

  it("odpočet a lhůta se skloňují", () => {
    const format = (message: string, values: Record<string, number>) =>
      String(new IntlMessageFormat(message, "cs").format(values));
    expect(format(cs.social.countdown, { days: 2, hours: 6, minutes: 5 })).toBe("2 d 6 h");
    expect(format(cs.social.countdown, { days: 0, hours: 3, minutes: 12 })).toBe("3 h 12 min");
    expect(format(cs.social.hoursLeft, { hours: 3 })).toBe("zbývá 3 hodiny");
    expect(format(cs.social.hoursLeft, { hours: 41 })).toBe("zbývá 41 hodin");
  });
});
