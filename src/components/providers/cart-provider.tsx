"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

import * as cartService from "@/lib/services/cart-service";
import {
  calcCartSummary,
  clearAppliedCoupon,
  clearStoredCart,
  consumeCheckoutCompleted,
  loadCart,
  markCheckoutCompleted,
  saveCart,
} from "@/lib/utils/cart-storage";
import {
  getCartItemKey,
  getDefaultPurchaseVariant,
  getMaxPurchasableQuantity,
  isOutOfStock,
  normalizeProduct,
  resolvePurchaseVariant,
} from "@/lib/utils/product-schema";
import { getAddToCartErrorMessage } from "@/lib/utils/order-errors";
import { getToastErrorMessage } from "@/lib/utils/toast-error";
import { getAccessToken } from "@/lib/api/client";
import { useCartUi } from "@/components/providers/cart-ui-provider";
import { useWishlistCompare } from "@/components/providers/wishlist-compare-provider";
import type {
  CartItem,
  CartSummary,
  NormalizedProduct,
  PlacedOrder,
  PurchaseVariant,
} from "@/types/cart";

type CartContextValue = {
  cartItems: CartItem[];
  cartSummary: CartSummary;
  licenseKeyOrder: PlacedOrder | null;
  isAuthenticated: boolean;
  addToCart: (
    product: NormalizedProduct | Record<string, unknown>,
    quantity?: number,
    selectedVariant?: PurchaseVariant | null,
  ) => Promise<boolean>;
  removeFromCart: (
    productId: string,
    variant?: PurchaseVariant | null,
  ) => Promise<void>;
  updateCartQuantity: (
    productId: string,
    quantity: number,
    variant?: PurchaseVariant | null,
  ) => Promise<void>;
  updateCartVariant: (
    cartItem: CartItem,
    nextVariant: PurchaseVariant,
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  completeCheckout: () => Promise<void>;
  closeLicenseKeyModal: () => void;
  showLicenseKeysFromOrder: (order: PlacedOrder) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function mergeCartItems(baseItems: CartItem[] = [], incomingItems: CartItem[] = []) {
  const merged = new Map<string, CartItem>();

  [...baseItems, ...incomingItems].forEach((item) => {
    const key = getCartItemKey(item);
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, {
        ...existing,
        quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
        product: existing.product || item.product,
        variant: existing.variant || item.variant || null,
      });
      return;
    }

    merged.set(key, {
      ...item,
      quantity: Number(item.quantity) || 1,
      variant: item.variant || null,
    });
  });

  return Array.from(merged.values());
}

function getSessionUser(session: ReturnType<typeof useSession>["data"]) {
  if (!session?.user) return null;

  return {
    _id: session.user.id,
    id: session.user.id,
    email: session.user.email || undefined,
    name: session.user.name || undefined,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const sessionUser = useMemo(
    () => getSessionUser(session),
    [session],
  );
  const isAuthenticated = status === "authenticated";

  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    typeof window !== "undefined" ? loadCart() : [],
  );
  const [licenseKeyOrder, setLicenseKeyOrder] = useState<PlacedOrder | null>(null);
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    setCartItems(loadCart(sessionUser));
    setHydrated(true);
  }, [sessionUser]);

  useEffect(() => {
    if (!hydrated) return;

    saveCart(cartItems, sessionUser);
  }, [cartItems, sessionUser, hydrated]);

  useEffect(() => {
    if (status !== "authenticated" || !getAccessToken()) return;

    const syncServerCart = async () => {
      try {
        const localCart = loadCart();
        const serverCart = await cartService.fetchCart();

        if (localCart.length > 0) {
          const mergedCart = mergeCartItems(serverCart, localCart);
          const syncedCart = await cartService.replaceCart(mergedCart);
          clearStoredCart();
          setCartItems(syncedCart);
        } else {
          setCartItems(serverCart);
        }
      } catch {
        setCartItems(loadCart(sessionUser));
      }
    };

    syncServerCart();
  }, [status, sessionUser]);

  useEffect(() => {
    const clearCompletedCheckoutCart = () => {
      if (!consumeCheckoutCompleted()) {
        return;
      }

      clearAppliedCoupon();
      clearStoredCart(sessionUser);
      setCartItems([]);

      if (getAccessToken()) {
        cartService.replaceCart([]).catch(() => {});
      }
    };

    clearCompletedCheckoutCart();

    window.addEventListener("pageshow", clearCompletedCheckoutCart);
    window.addEventListener("focus", clearCompletedCheckoutCart);
    document.addEventListener("visibilitychange", clearCompletedCheckoutCart);

    return () => {
      window.removeEventListener("pageshow", clearCompletedCheckoutCart);
      window.removeEventListener("focus", clearCompletedCheckoutCart);
      document.removeEventListener("visibilitychange", clearCompletedCheckoutCart);
    };
  }, [sessionUser]);

  const addToCart = useCallback(
    async (
      product: NormalizedProduct | Record<string, unknown>,
      quantity = 1,
      selectedVariant: PurchaseVariant | null | undefined = undefined,
    ) => {
      const normalizedProduct = normalizeProduct(product as Record<string, unknown>);

      if (!normalizedProduct) return false;

      const variant =
        selectedVariant === undefined
          ? getDefaultPurchaseVariant(normalizedProduct)
          : resolvePurchaseVariant(normalizedProduct, selectedVariant);

      if (isOutOfStock(normalizedProduct)) {
        toast.error(getAddToCartErrorMessage(normalizedProduct.name));
        return false;
      }

      const cartKey = getCartItemKey({
        productId: normalizedProduct.id,
        variant,
      });
      const existingQuantity =
        cartItems.find((item) => getCartItemKey(item) === cartKey)?.quantity ?? 0;
      const maxQuantity = getMaxPurchasableQuantity(
        normalizedProduct,
        existingQuantity,
      );

      if (quantity > maxQuantity) {
        toast.error(
          normalizedProduct.usesKeyPool
            ? `Chỉ còn ${normalizedProduct.stock} key trong kho`
            : `Chỉ còn ${normalizedProduct.stock} sản phẩm trong kho`,
        );
        return false;
      }

      if (getAccessToken()) {
        try {
          const items = await cartService.addToCart(
            normalizedProduct.id,
            quantity,
            variant,
          );
          setCartItems(items);
          toast.success("Đã thêm vào giỏ");
          return true;
        } catch (error) {
          toast.error(getToastErrorMessage(error, "Không thể thêm vào giỏ"));
          return false;
        }
      }

      setCartItems((prev) => {
        const existing = prev.find(
          (item) =>
            getCartItemKey(item) ===
            getCartItemKey({ productId: normalizedProduct.id, variant }),
        );

        if (existing) {
          return prev.map((item) =>
            getCartItemKey(item) ===
            getCartItemKey({ productId: normalizedProduct.id, variant })
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  variant,
                }
              : item,
          );
        }

        return [
          ...prev,
          {
            productId: normalizedProduct.id,
            quantity,
            variant,
            product: normalizedProduct,
          },
        ];
      });

      toast.success("Đã thêm vào giỏ");
      return true;
    },
    [cartItems],
  );

  const removeFromCart = useCallback(
    async (productId: string, variant: PurchaseVariant | null = null) => {
      if (getAccessToken()) {
        try {
          const items = await cartService.removeFromCart(productId, variant);
          setCartItems(items);
        } catch (error) {
          toast.error(getToastErrorMessage(error, "Không thể cập nhật giỏ hàng"));
        }
        return;
      }

      setCartItems((prev) =>
        prev.filter(
          (item) =>
            getCartItemKey(item) !== getCartItemKey({ productId, variant }),
        ),
      );
    },
    [],
  );

  const updateCartQuantity = useCallback(
    async (
      productId: string,
      quantity: number,
      variant: PurchaseVariant | null = null,
    ) => {
      if (quantity < 1) {
        await removeFromCart(productId, variant);
        return;
      }

      if (getAccessToken()) {
        try {
          const items = await cartService.updateCartItem(
            productId,
            quantity,
            variant,
          );
          setCartItems(items);
        } catch (error) {
          toast.error(getToastErrorMessage(error, "Không thể cập nhật giỏ hàng"));
        }
        return;
      }

      setCartItems((prev) =>
        prev.map((item) =>
          getCartItemKey(item) === getCartItemKey({ productId, variant })
            ? { ...item, quantity }
            : item,
        ),
      );
    },
    [removeFromCart],
  );

  const updateCartVariant = useCallback(
    async (cartItem: CartItem, nextVariant: PurchaseVariant) => {
      if (!cartItem?.product || !nextVariant) return;

      const product = normalizeProduct(
        cartItem.product as unknown as Record<string, unknown>,
      );

      if (!product) return;

      const variant = resolvePurchaseVariant(product, nextVariant);

      if (!variant || variant.id === cartItem.variant?.id) {
        return;
      }

      await removeFromCart(cartItem.productId, cartItem.variant);
      await addToCart(product, cartItem.quantity, variant);
    },
    [addToCart, removeFromCart],
  );

  const clearCart = useCallback(async () => {
    if (getAccessToken()) {
      try {
        await cartService.replaceCart([]);
      } catch {
        // ignore
      }
    }

    setCartItems([]);
  }, []);

  const completeCheckout = useCallback(async () => {
    markCheckoutCompleted();
    clearAppliedCoupon();
    clearStoredCart(sessionUser);
    await clearCart();
  }, [clearCart, sessionUser]);

  const showLicenseKeysFromOrder = useCallback((order: PlacedOrder) => {
    const hasKeys = order?.items?.some((item) => item.licenseKeys?.length);
    const hasAccounts = order?.items?.some((item) => item.accountCredentials?.length);

    if (hasKeys || hasAccounts) {
      setLicenseKeyOrder(order);
    }
  }, []);

  const closeLicenseKeyModal = useCallback(() => {
    setLicenseKeyOrder(null);
  }, []);

  const cartSummary = useMemo(() => calcCartSummary(cartItems), [cartItems]);

  const value = useMemo(
    () => ({
      cartItems,
      cartSummary,
      licenseKeyOrder,
      isAuthenticated,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartVariant,
      clearCart,
      completeCheckout,
      closeLicenseKeyModal,
      showLicenseKeysFromOrder,
    }),
    [
      cartItems,
      cartSummary,
      licenseKeyOrder,
      isAuthenticated,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartVariant,
      clearCart,
      completeCheckout,
      closeLicenseKeyModal,
      showLicenseKeysFromOrder,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartCore() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCartCore must be used within CartProvider");
  }

  return context;
}

/** Gộp cart + wishlist/compare + panel UI — tương thích code cũ */
export function useCart() {
  const cart = useCartCore();
  const wishlistCompare = useWishlistCompare();
  const cartUi = useCartUi();

  return useMemo(
    () => ({
      ...cart,
      ...wishlistCompare,
      ...cartUi,
    }),
    [cart, wishlistCompare, cartUi],
  );
}
