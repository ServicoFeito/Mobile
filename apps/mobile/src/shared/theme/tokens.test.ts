import { cores } from "./tokens";

const tw = require("../../../tailwind.config.js").theme.extend.colors.sf;

describe("tokens de tema", () => {
  it("primary/body/dark-green batem com o tailwind.config", () => {
    expect(cores.primary).toBe(tw.primary);
    expect(cores.body).toBe(tw.body);
    expect(cores.darkGreen).toBe(tw["dark-green"]);
  });

  it("todo valor é um hex de 6 dígitos", () => {
    for (const v of Object.values(cores)) {
      expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
