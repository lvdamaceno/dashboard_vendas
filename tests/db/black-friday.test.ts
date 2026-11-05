import { describe, expect, it } from "vitest";
import { blackFridayAtiva, setBlackFridayAtiva } from "@/lib/black-friday";
import { hasDb, useTestDb } from "./helpers";

describe.skipIf(!hasDb)("chave da Black Friday", () => {
  useTestDb();

  it("começa ligada, desliga e liga de novo", async () => {
    expect(await blackFridayAtiva()).toBe(true);
    await setBlackFridayAtiva(false);
    expect(await blackFridayAtiva()).toBe(false);
    await setBlackFridayAtiva(true);
    expect(await blackFridayAtiva()).toBe(true);
  });
});
