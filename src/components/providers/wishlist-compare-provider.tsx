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

import * as wishlistService from "@/lib/services/wishlist-service";
import {
  loadCompare,
  MAX_COMPARE_ITEMS,
  saveCompare,
} from "@/lib/utils/compare-storage";
import { normalizeProduct } from "@/lib/utils/product-schema";
import { getToastErrorMessage } from "@/lib/utils/toast-error";
import {
  clearStoredWishlist,
  loadWishlist,
  saveWishlist,
} from "@/lib/utils/wishlist-storage";
import { getAccessToken } from "@/lib/api/client";
import type { NormalizedProduct } from "@/types/cart";

type WishlistCompareContextValue = {
  wishlist: NormalizedProduct[];
  compareItems: NormalizedProduct[];
  toggleWishlist: (product: NormalizedProduct | Record<string, unknown>) => void;
  isInWishlist: (productId: string) => boolean;
  toggleCompare: (product: NormalizedProduct | Record<string, unknown>) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
};

const WishlistCompareContext = createContext<WishlistCompareContextValue | null>(null);

function getSessionUser(session: ReturnType<typeof useSession>["data"]) {
  if (!session?.user) return null;

  return {
    _id: session.user.id,
    id: session.user.id,
    email: session.user.email || undefined,
    name: session.user.name || undefined,
  };
}

export function WishlistCompareProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const sessionUser = useMemo(
    () => getSessionUser(session),
    [session],
  );

  const [wishlist, setWishlist] = useState<NormalizedProduct[]>(() =>
    typeof window !== "undefined" ? loadWishlist() : [],
  );
  const [compareItems, setCompareItems] = useState<NormalizedProduct[]>(() =>
    typeof window !== "undefined" ? loadCompare() : [],
  );
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    setWishlist(loadWishlist(sessionUser));
    setCompareItems(loadCompare());
    setHydrated(true);
  }, [sessionUser]);

  useEffect(() => {
    if (!hydrated) return;
    saveWishlist(wishlist, sessionUser);
  }, [wishlist, sessionUser, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveCompare(compareItems);
  }, [compareItems, hydrated]);

  useEffect(() => {
    if (status !== "authenticated" || !getAccessToken()) return;

    const syncServerWishlist = async () => {
      try {
        const localWishlist = loadWishlist();
        const serverWishlist = await wishlistService.fetchWishlist();

        if (localWishlist.length > 0) {
          const mergedIds = Array.from(
            new Set([
              ...serverWishlist.map((item) => String(item.id)),
              ...localWishlist.map((item: { id?: string | number }) => String(item.id)),
            ]),
          );
          const syncedWishlist = await wishlistService.replaceWishlist(mergedIds);
          clearStoredWishlist();
          setWishlist(syncedWishlist);
        } else {
          setWishlist(serverWishlist);
        }
      } catch {
        setWishlist(loadWishlist(sessionUser));
      }
    };

    syncServerWishlist();
  }, [status, sessionUser]);

  const toggleWishlist = useCallback(
    async (product: NormalizedProduct | Record<string, unknown>) => {
      const normalizedProduct = normalizeProduct(product as Record<string, unknown>);
      if (!normalizedProduct) return;

      const productId = String(normalizedProduct.id);
      const exists = wishlist.some((item) => String(item.id) === productId);

      if (getAccessToken()) {
        try {
          const items = exists
            ? await wishlistService.removeFromWishlist(productId)
            : await wishlistService.addToWishlist(productId);
          setWishlist(items);
          toast.success(exists ? "Đã bỏ khỏi yêu thích" : "Đã thêm vào yêu thích");
        } catch (error) {
          toast.error(getToastErrorMessage(error, "Không thể cập nhật yêu thích"));
        }
        return;
      }

      if (exists) {
        setWishlist((prev) => prev.filter((item) => String(item.id) !== productId));
        toast.success("Đã bỏ khỏi yêu thích");
        return;
      }

      setWishlist((prev) => [...prev, normalizedProduct]);
      toast.success("Đã thêm vào yêu thích");
    },
    [wishlist],
  );

  const isInWishlist = useCallback(
    (productId: string) => wishlist.some((item) => String(item.id) === String(productId)),
    [wishlist],
  );

  const toggleCompare = useCallback(
    (product: NormalizedProduct | Record<string, unknown>) => {
      const normalizedProduct = normalizeProduct(product as Record<string, unknown>);
      if (!normalizedProduct) return;

      const productId = String(normalizedProduct.id);
      const exists = compareItems.some((item) => String(item.id) === productId);

      if (exists) {
        setCompareItems((prev) => prev.filter((item) => String(item.id) !== productId));
        toast.success("Đã bỏ khỏi so sánh");
        return;
      }

      if (compareItems.length >= MAX_COMPARE_ITEMS) {
        toast.error(`So sánh tối đa ${MAX_COMPARE_ITEMS} sản phẩm`);
        return;
      }

      setCompareItems((prev) => [...prev, normalizedProduct]);
      toast.success("Đã thêm vào so sánh");
    },
    [compareItems],
  );

  const isInCompare = useCallback(
    (productId: string) => compareItems.some((item) => String(item.id) === String(productId)),
    [compareItems],
  );

  const removeFromCompare = useCallback((productId: string) => {
    setCompareItems((prev) => prev.filter((item) => String(item.id) !== String(productId)));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareItems([]);
    toast.success("Đã xóa danh sách so sánh");
  }, []);

  const value = useMemo(
    () => ({
      wishlist,
      compareItems,
      toggleWishlist,
      isInWishlist,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
    }),
    [
      wishlist,
      compareItems,
      toggleWishlist,
      isInWishlist,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
    ],
  );

  return (
    <WishlistCompareContext.Provider value={value}>{children}</WishlistCompareContext.Provider>
  );
}

export function useWishlistCompare() {
  const context = useContext(WishlistCompareContext);
  if (!context) {
    throw new Error("useWishlistCompare must be used within WishlistCompareProvider");
  }
  return context;
}
