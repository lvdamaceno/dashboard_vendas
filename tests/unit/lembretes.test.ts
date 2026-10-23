import { describe, expect, it } from "vitest";
import { lastOccurrence, nextOccurrence } from "@/lib/lembretes";

describe("ocorrências dos lembretes", () => {
  it.each([
    [{ recorrencia: "mensal", dia: 1 }, "2026-10-23", "2026-10-01", "2026-11-01"],
    [{ recorrencia: "mensal", dia: 1 }, "2026-11-01", "2026-11-01", "2026-12-01"],
    [{ recorrencia: "mensal", dia: 31 }, "2026-11-15", "2026-10-31", "2026-11-30"],
    [{ recorrencia: "mensal", dia: 31 }, "2026-02-28", "2026-02-28", "2026-03-31"],
    [{ recorrencia: "mensal", dia: 5 }, "2026-01-03", "2025-12-05", "2026-01-05"],
    [{ recorrencia: "semanal", dia: 1 }, "2026-10-23", "2026-10-19", "2026-10-26"],
    [{ recorrencia: "diaria" }, "2026-10-23", "2026-10-23", "2026-10-24"],
    [{ recorrencia: "unica", data: "2026-12-01" }, "2026-10-23", null, "2026-12-01"],
    [{ recorrencia: "unica", data: "2026-10-01" }, "2026-10-23", "2026-10-01", null],
  ] as const)("%o em %s", (r, hoje, ultima, proxima) => {
    const rem = { dia: null, data: null, ...r } as Parameters<typeof lastOccurrence>[0];
    expect(lastOccurrence(rem, hoje)).toBe(ultima);
    expect(nextOccurrence(rem, hoje)).toBe(proxima);
  });
});
