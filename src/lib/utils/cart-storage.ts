import { getCartItemListPrice, getCartItemSalePrice } from "@/lib/utils/product-schema";
import type { AppliedCoupon, CartItem, CartSummary } from "@/types/cart";

const LEGACY_CART_KEY = "cart";
const GUEST_CART_KEY = "cart:guest";
const COMPLETED_CHECKOUT_KEY = "completedCheckoutAt";
const APPLIED_COUPON_KEY = "appliedCoupon";

export function getUserCartKey(user: { _id?: string; id?: string; email?: string } | null = null) {
  const userId = user?._id || user?.id || user?.email;

  return userId ? `cart:${String(userId)}` : GUEST_CART_KEY;
}

function migrateLegacyGuestCart() {
  if (typeof window === "undefined") return;

  const legacyCart = localStorage.getItem(LEGACY_CART_KEY);

  if (legacyCart && !localStorage.getItem(GUEST_CART_KEY)) {
    localStorage.setItem(GUEST_CART_KEY, legacyCart);
  }

  if (legacyCart) {
    localStorage.removeItem(LEGACY_CART_KEY);
  }
}

export function loadCart(
  user: { _id?: string; id?: string; email?: string } | null = null,
): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    if (!user) {
      migrateLegacyGuestCart();
    }

    const raw = localStorage.getItem(getUserCartKey(user));

    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(
  items: CartItem[],
  user: { _id?: string; id?: string; email?: string } | null = null,
) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getUserCartKey(user), JSON.stringify(items));
}

export function clearStoredCart(
  user: { _id?: string; id?: string; email?: string } | null = null,
) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getUserCartKey(user), JSON.stringify([]));
}

export function markCheckoutCompleted() {
  if (typeof window === "undefined") return;

  localStorage.setItem(COMPLETED_CHECKOUT_KEY, String(Date.now()));
}

export function consumeCheckoutCompleted() {
  if (typeof window === "undefined") return false;

  const value = localStorage.getItem(COMPLETED_CHECKOUT_KEY);

  if (value) {
    localStorage.removeItem(COMPLETED_CHECKOUT_KEY);
  }

  return Boolean(value);
}

export function calcCartSummary(items: CartItem[]): CartSummary {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + getCartItemSalePrice(item) * item.quantity,
    0,
  );

  const listSubtotal = items.reduce((sum, item) => {
    const list = getCartItemListPrice(item);
    const sale = getCartItemSalePrice(item);
    const unitList = list != null && list > sale ? list : sale;

    return sum + unitList * item.quantity;
  }, 0);

  const savings = Math.max(0, listSubtotal - subtotal);
  const total = Math.max(0, subtotal);

  return {
    count,
    listSubtotal,
    subtotal,
    savings,
    tax: 0,
    total,
  };
}

export function getPayableCartTotal(
  summary: CartSummary,
  coupon: AppliedCoupon | null | undefined,
) {
  if (coupon && Number(coupon.subtotal) === Number(summary.subtotal)) {
    return Math.max(0, coupon.total);
  }

  return summary.total;
}

// --- Applied coupon persistence -------------------------------------------
// The coupon a shopper applied on the cart page must survive navigation to
// checkout, so it lives in localStorage. Centralised here (single key, safe
// parse) so the cart page, checkout page, and cart provider stay in sync.

export function loadAppliedCoupon(): AppliedCoupon | null {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(
      localStorage.getItem(APPLIED_COUPON_KEY) || "null",
    ) as AppliedCoupon | null;
  } catch {
    return null;
  }
}

export function saveAppliedCoupon(coupon: AppliedCoupon) {
  if (typeof window === "undefined") return;

  localStorage.setItem(APPLIED_COUPON_KEY, JSON.stringify(coupon));
}

export function clearAppliedCoupon() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(APPLIED_COUPON_KEY);
}

// A stored coupon only applies while the cart subtotal it was validated against
// still matches (items may have changed since it was applied).
export function isAppliedCouponValid(
  coupon: AppliedCoupon | null | undefined,
  subtotal: number,
): boolean {
  return (
    Boolean(coupon) &&
    subtotal > 0 &&
    Number(coupon?.subtotal) === Number(subtotal)
  );
}
