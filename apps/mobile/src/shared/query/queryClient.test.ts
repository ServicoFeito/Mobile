import { queryClient, limparCacheQuery } from "./queryClient";

describe("queryClient", () => {
  it("queries default: retry 2, staleTime 30s", () => {
    const q = queryClient.getDefaultOptions().queries!;
    expect(q.retry).toBe(2);
    expect(q.staleTime).toBe(30_000);
  });

  it("limparCacheQuery esvazia o cache", () => {
    queryClient.setQueryData(["x"], 1);
    expect(queryClient.getQueryData(["x"])).toBe(1);
    limparCacheQuery();
    expect(queryClient.getQueryData(["x"])).toBeUndefined();
  });
});
