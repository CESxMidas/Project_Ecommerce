import { describe, expect, it } from "vitest";

import {
  computeDiscountLabel,
  getCartItemKey,
  getListPrice,
  getMaxPurchasableQuantity,
  getPurchaseVariants,
  getSalePrice,
  isOutOfStock,
  normalizeProduct,
  resolvePurchaseVariant,
} from "@/lib/utils/product-schema";
import type { NormalizedProduct } from "@/types/cart";

const digitalRaw = {
  productId: 1,
  name: "Windows 11 Pro",
  price: 300000,
  productType: "license_key",
  deliveryType: "instant_key",
  stock: 5,
};

describe("pricing helpers", () => {
  it("returns the discounted price when lower than list", () => {
    expect(getSalePrice({ price: 100000, discountPrice: 80000 })).toBe(80000);
  });

  it("falls back to list price when there is no valid discount", () => {
    expect(getSalePrice({ price: 100000, discountPrice: null })).toBe(100000);
  });

  it("exposes list price only when a real discount exists", () => {
    expect(getListPrice({ price: 100000, discountPrice: 80000 })).toBe(100000);
    expect(getListPrice({ price: 100000, discountPrice: null })).toBeNull();
  });

  it("computes a percentage discount label", () => {
    expect(computeDiscountLabel({ price: 100000, discountPrice: 75000 })).toBe("-25%");
  });
});

describe("getPurchaseVariants — synthetic fallback", () => {
  const product = normalizeProduct(digitalRaw) as NormalizedProduct;

  it("synthesises day/month/year packages with accented names", () => {
    const variants = getPurchaseVariants(product);
    expect(variants.map((v) => v.id)).toEqual(["daily", "monthly", "yearly"]);
    expect(variants.map((v) => v.name)).toEqual(["Key ngày", "Key tháng", "Key năm"]);
  });

  it("prices day ~= month/30 and year = month*10", () => {
    const variants = getPurchaseVariants(product);
    const monthly = variants.find((v) => v.id === "monthly")!.price;
    const daily = variants.find((v) => v.id === "daily")!.price;
    const yearly = variants.find((v) => v.id === "yearly")!.price;

    expect(monthly).toBe(300000);
    expect(daily).toBe(Math.round(300000 / 30));
    expect(yearly).toBe(300000 * 10);
  });

  it("returns no variants for a physical product", () => {
    const hardware = normalizeProduct({
      productId: 2,
      name: "USB",
      price: 50000,
      productType: "hardware",
      deliveryType: "physical",
      stock: 3,
    }) as NormalizedProduct;

    expect(getPurchaseVariants(hardware)).toEqual([]);
  });

  it("prefers explicit variants over synthetic ones", () => {
    const withVariants = normalizeProduct({
      ...digitalRaw,
      variants: [{ id: "v1", name: "1 năm", price: 200000 }],
    }) as NormalizedProduct;

    const variants = getPurchaseVariants(withVariants);
    expect(variants).toHaveLength(1);
    expect(variants[0].id).toBe("v1");
  });
});

describe("resolvePurchaseVariant", () => {
  const product = normalizeProduct(digitalRaw) as NormalizedProduct;

  it("resolves a variant by id", () => {
    expect(resolvePurchaseVariant(product, "yearly")?.id).toBe("yearly");
  });

  it("falls back to the first variant for an unknown id", () => {
    expect(resolvePurchaseVariant(product, "nope")?.id).toBe("daily");
  });
});

describe("stock helpers", () => {
  it("flags an out-of-stock product", () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true);
    expect(isOutOfStock({ stock: 3 })).toBe(false);
  });

  it("caps purchasable quantity by remaining stock", () => {
    expect(getMaxPurchasableQuantity({ stock: 5 }, 2)).toBe(3);
    expect(getMaxPurchasableQuantity({ stock: 5 }, 5)).toBe(0);
  });
});

describe("getCartItemKey", () => {
  it("keys by product id and variant id", () => {
    expect(
      getCartItemKey({ productId: "1", variant: { id: "monthly" } as never }),
    ).toBe("1:monthly");
  });

  it("uses 'default' when there is no variant", () => {
    expect(getCartItemKey({ productId: "1" })).toBe("1:default");
  });
});
