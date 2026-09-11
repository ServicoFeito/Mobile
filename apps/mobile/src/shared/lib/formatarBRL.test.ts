import { formatarBRL } from "./formatarBRL";

it.each([
  [300, "R$ 300,00"],
  [0, "R$ 0,00"],
  [199.9, "R$ 199,90"],
  [1234.5, "R$ 1234,50"],
])("formata %s -> %s", (v, esperado) => expect(formatarBRL(v)).toBe(esperado));
