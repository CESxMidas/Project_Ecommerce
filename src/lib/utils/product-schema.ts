import { resolveMediaUrl } from "@/lib/utils/image";
import type { NormalizedProduct, PurchaseVariant } from "@/types/cart";

type ProductPricing = {
  price?: number | string;
  discountPrice?: number | string | null;
  salePrice?: number | string | null;
  discount?: string;
};

export function getSalePrice(product: ProductPricing | null) {
  if (!product) return 0;

  const list = Number(product.price);
  const sale =
    product.discountPrice != null ? Number(product.discountPrice) : null;

  if (sale != null && !Number.isNaN(sale) && sale < list) {
    return sale;
  }

  if (product.salePrice != null) {
    return Number(product.salePrice);
  }

  return Number.isNaN(list) ? 0 : list;
}

export function getListPrice(product: ProductPricing | null) {
  if (!product) return null;

  const list = Number(product.price);
  const sale = getSalePrice(product);

  return sale < list ? list : null;
}

export function computeDiscountLabel(product: ProductPricing | null) {
  const list = getListPrice(product);
  const sale = getSalePrice(product);

  if (!list || list <= sale) {
    return product?.discount;
  }

  return `-${Math.round(((list - sale) / list) * 100)}%`;
}

export function normalizeProductType(value?: string) {
  const allowed = [
    "license_key",
    "redeem_code",
    "account",
    "manual_service",
    "hardware",
  ];

  return allowed.includes(value || "") ? value! : "manual_service";
}

export function normalizeDeliveryType(value?: string, productType?: string) {
  const allowed = [
    "instant_key",
    "account_credentials",
    "manual_delivery",
    "physical",
  ];

  if (value && allowed.includes(value)) {
    return value;
  }

  if (productType === "hardware") return "physical";
  if (productType === "license_key" || productType === "redeem_code") {
    return "instant_key";
  }
  if (productType === "account") return "account_credentials";

  return "manual_delivery";
}

export function normalizeProduct(raw: Record<string, unknown> | null) {
  if (!raw) return null;

  const salePrice = getSalePrice(raw as unknown as NormalizedProduct);
  const listPrice = getListPrice(raw as unknown as NormalizedProduct);
  const rawThumbnail =
    (raw.thumbnail as string) ||
    (raw.image as string) ||
    ((raw.images as string[])?.[0] ?? "");
  const thumbnail = resolveMediaUrl(rawThumbnail, "");
  const images =
    Array.isArray(raw.images) && raw.images.length > 0
      ? (raw.images as string[])
          .map((image) => resolveMediaUrl(image, thumbnail))
          .filter(Boolean)
      : thumbnail
        ? [thumbnail]
        : [];

  const productType = normalizeProductType(raw.productType as string);
  const deliveryType = normalizeDeliveryType(
    raw.deliveryType as string,
    productType,
  );
  const requiresOnlinePayment =
    raw.requiresOnlinePayment !== undefined
      ? Boolean(raw.requiresOnlinePayment)
      : deliveryType !== "physical";
  const rawVariants = Array.isArray(raw.variants) ? raw.variants : [];

  return {
    id: String(raw.id ?? raw.productId ?? raw._id ?? ""),
    sku: (raw.sku as string) || "",
    name: (raw.name as string) || (raw.title as string) || "",
    slug: (raw.slug as string) || "",
    description: (raw.description as string) || "",
    price: Number(raw.price ?? salePrice) || 0,
    discountPrice: raw.discountPrice as number | null | undefined,
    currency: (raw.currency as string) || "VND",
    images,
    thumbnail,
    categoryId: raw.categoryId != null ? String(raw.categoryId) : "",
    categoryName: (raw.categoryName as string) || "",
    vendor: (raw.vendor as string) || (raw.brand as string) || "",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    attributes: (raw.attributes as Record<string, unknown>) || {},
    variants: rawVariants as PurchaseVariant[],
    usesKeyPool: Boolean(raw.usesKeyPool) || undefined,
    stock: Number(raw.stock ?? 0),
    rating: Number(raw.rating ?? 0),
    reviewsCount: Number(raw.reviewsCount ?? 0),
    isActive: raw.isActive !== false,
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    badge: (raw.badge as string) || (raw.tag as string) || "",
    salePrice,
    listPrice,
    title: (raw.name as string) || (raw.title as string) || "",
    brand: (raw.vendor as string) || (raw.brand as string) || (raw.categoryName as string) || "",
    image: thumbnail,
    oldPrice: listPrice ?? 0,
    tag: (raw.badge as string) || (raw.tag as string) || "",
    discount:
      (raw.discount as string) ||
      computeDiscountLabel({ ...raw, salePrice, listPrice } as unknown as NormalizedProduct),
    productType,
    deliveryType,
    requiresOnlinePayment,
    keyPrefix: (raw.keyPrefix as string) || "",
    weight: Number(raw.weight ?? 0),
    dimensions: (raw.dimensions as NormalizedProduct["dimensions"]) || {
      length: 0,
      width: 0,
      height: 0,
    },
  } satisfies NormalizedProduct;
}

export function isPhysicalProduct(product: Partial<NormalizedProduct> | null) {
  return (
    product?.deliveryType === "physical" || product?.productType === "hardware"
  );
}

export function isLicenseKeyProduct(product: Partial<NormalizedProduct> | null) {
  return product?.productType === "license_key";
}

export function isInstantCodeProduct(product: Partial<NormalizedProduct> | null) {
  return ["license_key", "redeem_code"].includes(product?.productType || "");
}

export function usesKeyPool(product: Partial<NormalizedProduct> | null) {
  return Boolean(
    (product as { usesKeyPool?: boolean })?.usesKeyPool || isInstantCodeProduct(product),
  );
}

export function isOutOfStock(product: Partial<NormalizedProduct> | null) {
  return Number(product?.stock ?? 0) <= 0;
}

export function getStockStatusLabel(product: Partial<NormalizedProduct> | null) {
  if (isOutOfStock(product)) {
    return usesKeyPool(product) ? "Hết key" : "Hết hàng";
  }

  return usesKeyPool(product) ? "Còn key" : "Còn hàng";
}

export function getStockDetailLabel(product: Partial<NormalizedProduct> | null) {
  const stock = Number(product?.stock ?? 0);

  if (stock <= 0) {
    return usesKeyPool(product)
      ? "Hết key trong kho"
      : "Hết hàng";
  }

  return usesKeyPool(product)
    ? `Còn ${stock} key`
    : `Còn ${stock} sản phẩm`;
}

export function getMaxPurchasableQuantity(
  product: Partial<NormalizedProduct> | null,
  currentQuantity = 0,
) {
  const stock = Number(product?.stock ?? 0);
  return Math.max(0, stock - currentQuantity);
}

function normalizePurchaseVariant(
  raw: Record<string, unknown>,
  fallbackPrice: number,
  fallbackListPrice: number | null = null,
): PurchaseVariant | null {
  const id = String(raw?.id || raw?.code || raw?.name || "").trim();
  const name = String(raw?.name || raw?.label || id).trim();
  const price = Number(raw?.price ?? raw?.salePrice ?? fallbackPrice);
  const listPrice =
    raw?.listPrice != null ? Number(raw.listPrice) : fallbackListPrice;
  const color = raw?.color ? String(raw.color).trim() : "";

  if (!id || !name || Number.isNaN(price) || price < 0) {
    return null;
  }

  return {
    id,
    name,
    price,
    listPrice:
      listPrice != null && !Number.isNaN(listPrice) ? listPrice : null,
    duration: (raw?.duration as string) || id,
    color: color || null,
  };
}

// When a digital product ships without explicit variants, we synthesise
// day/month/year packages from the monthly (base) sale price: a day is ~1/30 of
// a month, and a year is priced at 10 months (i.e. 2 months free vs paying 12×).
const SYNTHETIC_DAILY_PRICE_DIVISOR = 30;
const SYNTHETIC_YEARLY_PRICE_MULTIPLIER = 10;

export function getPurchaseVariants(
  product: NormalizedProduct | null,
): PurchaseVariant[] {
  if (!product) return [];

  const baseSalePrice = getSalePrice(product);
  const baseListPrice = getListPrice(product);
  const customVariants = Array.isArray(product.variants)
    ? product.variants
        .map((variant) =>
          normalizePurchaseVariant(
            variant as unknown as Record<string, unknown>,
            baseSalePrice,
            baseListPrice,
          ),
        )
        .filter(Boolean)
    : [];

  if (customVariants.length > 0) {
    return customVariants as PurchaseVariant[];
  }

  if (isPhysicalProduct(product)) {
    return [];
  }

  return [
    {
      id: "daily",
      name: "Key ngày",
      price: Math.max(0, Math.round(baseSalePrice / SYNTHETIC_DAILY_PRICE_DIVISOR)),
      listPrice: null,
      duration: "daily",
    },
    {
      id: "monthly",
      name: "Key tháng",
      price: baseSalePrice,
      listPrice: baseListPrice,
      duration: "monthly",
    },
    {
      id: "yearly",
      name: "Key năm",
      price: Math.round(baseSalePrice * SYNTHETIC_YEARLY_PRICE_MULTIPLIER),
      listPrice: null,
      duration: "yearly",
    },
  ];
}

export function getCartItemKey(
  itemOrProduct: { productId?: string; id?: string; variant?: PurchaseVariant | null },
  variant?: PurchaseVariant | null,
) {
  const productId = itemOrProduct?.productId ?? itemOrProduct?.id;
  const variantId = variant?.id || itemOrProduct?.variant?.id || "default";

  return `${productId}:${variantId}`;
}

export function getCartItemSalePrice(item: {
  variant?: PurchaseVariant | null;
  product?: NormalizedProduct | null;
}) {
  return (
    Number(item?.variant?.price ?? getSalePrice(item?.product || null)) || 0
  );
}

export function getCartItemListPrice(item: {
  variant?: PurchaseVariant | null;
  product?: NormalizedProduct | null;
}) {
  if (item?.variant?.listPrice != null) {
    return Number(item.variant.listPrice);
  }

  return getListPrice(item?.product || null);
}

export function getDeliveryLabel(product: Partial<NormalizedProduct> | null) {
  if (isPhysicalProduct(product)) return "Giao hàng vật lý";
  if (product?.productType === "account") return "Giao tài khoản";
  if (product?.productType === "manual_service") return "Dịch vụ thủ công";
  if (product?.productType === "redeem_code") return "Mã nạp";
  if (product?.productType === "license_key") return "Giao key ngay";

  return "Giao hàng số";
}

export function getProductDisplayName(product: Partial<NormalizedProduct> | null) {
  return product?.name || product?.title || "";
}

export function getProductThumbnail(product: Partial<NormalizedProduct> | null) {
  return product?.thumbnail || product?.image || product?.images?.[0] || "";
}

export function getProductImages(product: Partial<NormalizedProduct> | null) {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images;
  }

  const thumbnail = getProductThumbnail(product);
  return thumbnail ? [thumbnail] : [];
}

export function getProductTypeLabel(product: Partial<NormalizedProduct> | null) {
  const labels: Record<string, string> = {
    license_key: "Key bản quyền",
    redeem_code: "Mã nạp",
    account: "Tài khoản",
    manual_service: "Dịch vụ thủ công",
    hardware: "Phần cứng",
  };

  return labels[product?.productType || ""] || "Sản phẩm";
}

export function getDefaultPurchaseVariant(product: NormalizedProduct | null) {
  return getPurchaseVariants(product)[0] || null;
}

export function resolvePurchaseVariant(
  product: NormalizedProduct,
  requestedVariant?: PurchaseVariant | string | null,
) {
  const variants = getPurchaseVariants(product);

  if (variants.length === 0) {
    return null;
  }

  const requestedId =
    typeof requestedVariant === "string"
      ? requestedVariant
      : requestedVariant?.id;

  return variants.find((variant) => variant.id === requestedId) || variants[0];
}
