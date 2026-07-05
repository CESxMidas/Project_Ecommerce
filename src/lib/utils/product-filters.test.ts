import { describe, expect, it } from "vitest";

import {
  filterProducts,
  getUniqueBrands,
  paginateProducts,
  sortProducts,
} from "@/lib/utils/product-filters";
import { getSalePrice } from "@/lib/utils/product-schema";
import { mockProductsForFilter } from "@/test/fixtures/commerce";

describe("product-filters", () => {
  it("filters products by search query", () => {
    const result = filterProducts(mockProductsForFilter, { search: "office" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toMatch(/Office/i);
  });

  it("returns unique sorted brands", () => {
    const brands = getUniqueBrands(mockProductsForFilter);
    expect(brands).toEqual(["KEYSHOP QA", "Microsoft QA"]);
  });

  it("sorts products by price ascending", () => {
    const sorted = sortProducts(mockProductsForFilter, "price-asc");
    expect(getSalePrice(sorted[0])).toBeLessThanOrEqual(getSalePrice(sorted[1]));
  });

  it("paginates product list", () => {
    const page = paginateProducts(mockProductsForFilter, 1, 1);
    expect(page.items).toHaveLength(1);
    expect(page.totalPages).toBe(2);
    expect(page.totalItems).toBe(2);
  });

  it("filters deals only products", () => {
    const deals = filterProducts(mockProductsForFilter, { dealsOnly: true });
    expect(deals.length).toBeGreaterThan(0);
  });
});
