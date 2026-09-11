export function formatarBRL(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",");
}
