import { describe, expect, it } from "vitest";
import { emailConfirmationEnabled } from "@/lib/env";

describe("emailConfirmationEnabled", () => {
  it("is on unless explicitly turned off", () => {
    expect(emailConfirmationEnabled(undefined)).toBe(true);
    expect(emailConfirmationEnabled("")).toBe(true);
    expect(emailConfirmationEnabled("on")).toBe(true);
    expect(emailConfirmationEnabled("false")).toBe(true);
  });

  it("accepts off in any case and with spaces", () => {
    expect(emailConfirmationEnabled("off")).toBe(false);
    expect(emailConfirmationEnabled(" OFF ")).toBe(false);
  });
});
