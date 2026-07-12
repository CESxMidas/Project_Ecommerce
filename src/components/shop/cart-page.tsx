"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useCart } from "@/components/providers/cart-provider";
import { TrustSignals } from "@/components/commerce/trust-signals";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderSummaryTotals } from "@/components/shop/order-summary-totals";
import { checkoutCtaClass, fieldClass } from "@/lib/ui/tokens";
import { validateCoupon } from "@/lib/services/cms-service";
import {
  clearAppliedCoupon,
  isAppliedCouponValid,
  loadAppliedCoupon,
  saveAppliedCoupon,
} from "@/lib/utils/cart-storage";
import { cn } from "@/lib/utils";
import { getToastErrorMessage } from "@/lib/utils/toast-error";
import { formatPrice } from "@/lib/utils/format";
import {
  computeDiscountLabel,
  getCartItemListPrice,
  getCartItemSalePrice,
  getDeliveryLabel,
  getProductDisplayName,
  getProductThumbnail,
  getPurchaseVariants,
  isPhysicalProduct,
} from "@/lib/utils/product-schema";
import type { AppliedCoupon } from "@/types/cart";

export default function CartPageClient() {
  const {
    cartItems,
    cartSummary,
    isAuthenticated,
    removeFromCart,
    updateCartQuantity,
    updateCartVariant,
  } = useCart();

  const isEmpty = cartItems.length === 0;
  const hasDigitalItems = cartItems.some(
    (item) => !isPhysicalProduct(item.product),
  );

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    loadAppliedCoupon,
  );

  const hasValidCoupon = isAppliedCouponValid(appliedCoupon, cartSummary.subtotal);
  const effectiveCoupon = hasValidCoupon ? appliedCoupon : null;

  useEffect(() => {
    if (appliedCoupon && !hasValidCoupon) {
      clearAppliedCoupon();
    }
  }, [appliedCoupon, hasValidCoupon]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Vui lòng nhập mã giảm giá");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để áp dụng mã");
      return;
    }

    try {
      const result = await validateCoupon(couponCode.trim(), cartSummary.subtotal);

      saveAppliedCoupon(result);
      setAppliedCoupon(result);
      toast.success("Đã áp dụng mã giảm giá");
    } catch (error) {
      toast.error(getToastErrorMessage(error, "Mã giảm giá không hợp lệ"));
    }
  };

  const itemCountLabel =
    cartSummary.count === 1
      ? "1 sản phẩm trong giỏ"
      : `${cartSummary.count} sản phẩm trong giỏ`;

  return (
    <section className="container py-6 pb-12 sm:py-8 md:py-10 md:pb-16">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl md:text-4xl lg:text-[42px]">
            Giỏ hàng
          </h1>
          <p className="mt-1 text-[15px] text-keyshop-muted">{itemCountLabel}</p>
        </div>
        <Link
          href="/products"
          className="inline-flex h-[52px] items-center gap-2.5 rounded-control border border-keyshop-line bg-white/[0.04] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-keyshop-blue-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Tiếp tục mua sắm
        </Link>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={ShoppingBag}
          title="Giỏ hàng trống"
          description="Thêm key phần mềm hoặc sản phẩm số vào giỏ để tiếp tục thanh toán."
          actionLabel="Khám phá sản phẩm"
          actionHref="/products"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {cartItems.map((item) => {
              const variants = getPurchaseVariants(item.product);
              const itemSalePrice = getCartItemSalePrice(item);
              const itemListPrice = getCartItemListPrice(item);
              const vendor = (item.product.vendor || item.product.brand || "").toUpperCase();

              return (
                <div
                  key={`${item.productId}-${item.variant?.id || "default"}`}
                  className="rounded-card border border-keyshop-line bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-keyshop-blue/35 hover:bg-white/[0.045] sm:p-5"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start">
                    <div className="group relative mx-auto h-[120px] w-full max-w-[150px] shrink-0 overflow-hidden rounded-[18px] bg-white/10 sm:h-[140px] md:mx-0 md:w-[150px]">
                      <Image
                        src={getProductThumbnail(item.product)}
                        alt={getProductDisplayName(item.product)}
                        fill
                        className="object-cover transition group-hover:scale-105"
                        sizes="150px"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        {vendor ? (
                          <span className="inline-flex rounded-full border border-keyshop-blue/20 bg-keyshop-blue/15 px-3.5 py-2 text-xs font-bold text-sky-400">
                            {vendor}
                          </span>
                        ) : null}
                        <h3 className="mt-2 line-clamp-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
                          {getProductDisplayName(item.product)}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-keyshop-muted">
                          <span>{getDeliveryLabel(item.product)}</span>
                          <span>
                            {isPhysicalProduct(item.product)
                              ? "Hỗ trợ COD"
                              : "Yêu cầu VNPay"}
                          </span>
                        </div>
                      </div>

                      {variants.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-keyshop-muted">
                            {isPhysicalProduct(item.product) ? "Tùy chọn" : "Loại key"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {variants.map((variant) => {
                              const isActive = item.variant?.id === variant.id;
                              const color = variant.color;

                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  className={cn(
                                    "rounded-full border px-3 py-2 text-left text-xs font-extrabold transition",
                                    isActive
                                      ? "border-keyshop-blue bg-keyshop-blue/20 text-white"
                                      : "border-keyshop-line bg-white/[0.03] text-white/80 hover:border-keyshop-blue/40",
                                  )}
                                  onClick={() => updateCartVariant(item, variant)}
                                >
                                  <span className="flex items-center gap-2">
                                    {color ? (
                                      <span
                                        className="h-3.5 w-3.5 rounded-full border-2 border-white/75"
                                        style={{ backgroundColor: color }}
                                      />
                                    ) : null}
                                    {variant.name}
                                  </span>
                                  <span className="mt-1 block text-keyshop-blue">
                                    {formatPrice(variant.price)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        {itemListPrice != null ? (
                          <span className="text-2xl text-white/35 line-through">
                            {formatPrice(itemListPrice)}
                          </span>
                        ) : null}
                        <span className="text-xl font-extrabold text-keyshop-blue sm:text-2xl md:text-[28px]">
                          {formatPrice(itemSalePrice)}
                        </span>
                        {!item.variant && computeDiscountLabel(item.product) ? (
                          <span className="rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-400">
                            {computeDiscountLabel(item.product)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                      <div className="flex items-center rounded-2xl border border-keyshop-line bg-white/[0.04]">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center text-white transition hover:bg-white/8"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              item.quantity - 1,
                              item.variant,
                            )
                          }
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center text-white transition hover:bg-white/8"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              item.quantity + 1,
                              item.variant,
                            )
                          }
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <p className="text-lg font-extrabold text-white sm:text-xl md:text-2xl">
                        {formatPrice(itemSalePrice * item.quantity)}
                      </p>

                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-400 transition hover:bg-red-500 hover:text-white"
                        onClick={() => removeFromCart(item.productId, item.variant)}
                        aria-label="Xóa sản phẩm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-fit rounded-card border border-keyshop-line bg-white/[0.03] p-4 backdrop-blur-md sm:p-6 md:p-7 lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-white">Tóm tắt đơn hàng</h2>
            <div className="mt-5 space-y-4 text-sm">
              <OrderSummaryTotals
                cartSummary={cartSummary}
                effectiveCoupon={effectiveCoupon}
              />

              <div className="my-6 h-px bg-keyshop-line" />

              <div className="flex items-center gap-2">
                <input
                  placeholder="Mã giảm giá"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  aria-label="Mã giảm giá"
                  className={cn(fieldClass, "h-12 rounded-2xl px-4 py-0")}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="keyshop-interactive h-12 shrink-0 cursor-pointer whitespace-nowrap rounded-2xl bg-keyshop-blue-hover px-4 text-sm font-bold text-white transition hover:bg-keyshop-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-keyshop-blue/25"
                >
                  Áp dụng
                </button>
              </div>

              <Link href="/checkout" className={checkoutCtaClass}>
                Thanh toán an toàn
              </Link>

              <TrustSignals compact className="mt-2" />

              <div className="rounded-[14px] border border-sky-400/20 bg-keyshop-blue/10 px-3 py-2.5 text-center text-[13px] text-keyshop-muted">
                <div className="flex items-start justify-center gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <span>
                    {hasDigitalItems
                      ? "Sản phẩm số yêu cầu thanh toán online trước khi giao"
                      : "Sản phẩm vật lý hỗ trợ VNPay hoặc COD"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
