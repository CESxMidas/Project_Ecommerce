"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useCart } from "@/components/providers/cart-provider";
import { TrustSignals } from "@/components/commerce/trust-signals";
import { OrderSummaryTotals } from "@/components/shop/order-summary-totals";
import { placeOrder } from "@/lib/services/order-service";
import { fetchAddresses } from "@/lib/services/user-service";
import {
  clearAppliedCoupon,
  getPayableCartTotal,
  isAppliedCouponValid,
  loadAppliedCoupon,
} from "@/lib/utils/cart-storage";
import { checkoutCtaClass, fieldClass, labelClass } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/format";
import {
  getCartItemSalePrice,
  getDeliveryLabel,
  getProductDisplayName,
  getProductThumbnail,
  isPhysicalProduct,
} from "@/lib/utils/product-schema";
import type { AppliedCoupon, UserAddress } from "@/types/cart";
import { getCheckoutErrorMessage } from "@/lib/utils/order-errors";

type CheckoutForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  pincode: string;
  address: string;
};

const emptyForm: CheckoutForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  pincode: "",
  address: "",
};

// Prefill the checkout form from the signed-in user's name/email, and from a
// saved address when one is available. Phone is intentionally left blank on the
// initial load (the shopper confirms it, or applySavedAddress fills it in).
function buildInitialCheckoutForm(
  user: { name?: string | null; email?: string | null },
  address?: UserAddress | null,
): CheckoutForm {
  const nameParts = (user.name || "").trim().split(" ");

  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    email: user.email || "",
    phone: "",
    country: address?.country || "",
    city: address?.city || "",
    pincode: address?.pincode || "",
    address: address?.address_line || "",
  };
}

export default function CheckoutPageClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    cartItems,
    cartSummary,
    clearCart,
    completeCheckout,
    showLicenseKeysFromOrder,
  } = useCart();

  const allItemsAllowCod =
    cartItems.length > 0 &&
    cartItems.every((item) => isPhysicalProduct(item.product));
  const hasDigitalItems = cartItems.some(
    (item) => !isPhysicalProduct(item.product),
  );

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "cod">("vnpay");
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [formFields, setFormFields] = useState<CheckoutForm>(emptyForm);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    loadAppliedCoupon,
  );

  const hasValidCoupon = isAppliedCouponValid(appliedCoupon, cartSummary.subtotal);
  const effectiveCoupon = hasValidCoupon ? appliedCoupon : null;
  const displayTotal = getPayableCartTotal(cartSummary, effectiveCoupon);

  useEffect(() => {
    if (appliedCoupon && !hasValidCoupon) {
      clearAppliedCoupon();
      setAppliedCoupon(null);
    }
  }, [appliedCoupon, hasValidCoupon]);

  useEffect(() => {
    const user = session?.user;
    if (!user) return;

    const loadDefaultAddress = async () => {
      try {
        const data = await fetchAddresses();
        const addresses: UserAddress[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.addresses)
            ? data.addresses
            : [];

        if (addresses.length > 0) {
          setSavedAddresses(addresses);
          const defaultAddr =
            addresses.find((address) => address.isDefault) || addresses[0];
          setSelectedAddressId(defaultAddr.id || defaultAddr._id || "");
          setFormFields(buildInitialCheckoutForm(user, defaultAddr));
        } else {
          setFormFields(buildInitialCheckoutForm(user));
        }
      } catch {
        setFormFields(buildInitialCheckoutForm(user));
      }
    };

    loadDefaultAddress();
  }, [session?.user]);

  const applySavedAddress = (addressId: string) => {
    setSelectedAddressId(addressId);

    const selected = savedAddresses.find(
      (address) => String(address.id || address._id) === String(addressId),
    );

    if (!selected) return;

    setFormFields((prev) => ({
      ...prev,
      phone: selected.mobile || prev.phone,
      country: selected.country || "",
      city: selected.city || "",
      pincode: selected.pincode || "",
      address: selected.address_line || "",
    }));
  };

  const onChangeInput = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormFields({
      ...formFields,
      [event.target.name]: event.target.value,
    });
  };

  const validateCheckoutForm = () => {
    if (!formFields.firstName.trim()) {
      toast.error("Vui lòng nhập họ");
      return false;
    }

    if (!formFields.lastName.trim()) {
      toast.error("Vui lòng nhập tên");
      return false;
    }

    if (!formFields.email.trim()) {
      toast.error("Vui lòng nhập email");
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(formFields.email)) {
      toast.error("Email không hợp lệ");
      return false;
    }

    if (!formFields.phone.trim()) {
      toast.error("Vui lòng nhập số điện thoại");
      return false;
    }

    if (!/^[0-9+\-\s()]{8,20}$/.test(formFields.phone.trim())) {
      toast.error("Số điện thoại không hợp lệ");
      return false;
    }

    if (!formFields.address.trim()) {
      toast.error("Vui lòng nhập địa chỉ");
      return false;
    }

    if (!formFields.city.trim()) {
      toast.error("Vui lòng nhập thành phố");
      return false;
    }

    if (
      formFields.pincode.trim() &&
      !/^[A-Za-z0-9\-\s]{3,12}$/.test(formFields.pincode.trim())
    ) {
      toast.error("Mã bưu điện không hợp lệ");
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCheckoutForm()) return;

    if (!allItemsAllowCod && paymentMethod === "cod") {
      toast.error("COD chỉ áp dụng cho sản phẩm vật lý");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Giỏ hàng trống");
      return;
    }

    try {
      setLoading(true);

      let appliedCouponForOrder: AppliedCoupon | null = effectiveCoupon;

      if (
        appliedCouponForOrder &&
        Number(appliedCouponForOrder.subtotal) !== Number(cartSummary.subtotal)
      ) {
        clearAppliedCoupon();
        appliedCouponForOrder = null;
      }

      const order = await placeOrder({
        name: `${formFields.firstName} ${formFields.lastName}`.trim(),
        phone: formFields.phone,
        address: `${formFields.address}${formFields.city ? `, ${formFields.city}` : ""}${formFields.country ? `, ${formFields.country}` : ""}`,
        pincode: formFields.pincode.trim() || "DIGITAL",
        total: displayTotal,
        email: session?.user?.email || formFields.email,
        userId: session?.user?.email || formFields.email,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variant: item.variant || null,
          product: item.product,
        })),
        paymentMethod,
        couponCode: appliedCouponForOrder?.code || "",
      });

      if (order?.paymentUrl) {
        clearAppliedCoupon();
        await clearCart();
        window.location.href = order.paymentUrl;
        return;
      }

      await completeCheckout();
      showLicenseKeysFromOrder(order);
      toast.success("Đặt hàng thành công");

      if (
        !order?.items?.some(
          (item) => item.licenseKeys?.length || item.accountCredentials?.length,
        )
      ) {
        router.push("/account/orders");
      }
    } catch (error) {
      toast.error(getCheckoutErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-h-screen py-6 pb-12 sm:py-8 md:py-10 md:pb-16">
      <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
        <div className="space-y-6">
          <div className="rounded-card border border-keyshop-line bg-white/[0.03] p-4 backdrop-blur-xl sm:p-6 md:p-7">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl md:text-[34px]">Thanh toán</h1>
            <p className="mt-2 text-sm text-keyshop-muted">
              Xác nhận thông tin để giao key và sản phẩm số.
            </p>
          </div>

          <div className="rounded-card border border-keyshop-line bg-white/[0.03] p-4 backdrop-blur-xl sm:p-6 md:p-7">
            <h2 className="text-lg font-bold text-white sm:text-xl md:text-[22px]">Thông tin giao hàng</h2>
            <div className="mt-5 space-y-4">
              {savedAddresses.length > 0 ? (
                <div>
                  <label htmlFor="saved-address" className={labelClass}>
                    Địa chỉ đã lưu
                  </label>
                  <select
                    id="saved-address"
                    className={fieldClass}
                    value={selectedAddressId}
                    onChange={(event) => applySavedAddress(event.target.value)}
                  >
                    {savedAddresses.map((address) => (
                      <option
                        key={address.id || address._id}
                        value={address.id || address._id}
                        className="bg-keyshop-bg"
                      >
                        {address.isDefault ? "Mặc định — " : ""}
                        {address.label || address.address_line}, {address.city}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    Họ
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    value={formFields.firstName}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>
                    Tên
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    value={formFields.lastName}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formFields.email}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="phone" className={labelClass}>
                    Số điện thoại
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    value={formFields.phone}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="country" className={labelClass}>
                    Quốc gia
                  </label>
                  <input
                    id="country"
                    name="country"
                    value={formFields.country}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="city" className={labelClass}>
                    Thành phố
                  </label>
                  <input
                    id="city"
                    name="city"
                    value={formFields.city}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClass}>
                    Mã bưu điện
                  </label>
                  <input
                    id="pincode"
                    name="pincode"
                    value={formFields.pincode}
                    onChange={onChangeInput}
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="address" className={labelClass}>
                    Địa chỉ
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={5}
                    value={formFields.address}
                    onChange={onChangeInput}
                    className={cn(fieldClass, "min-h-[120px] resize-y")}
                  />
                </div>
              </form>
            </div>
          </div>

          <div className="rounded-card border border-keyshop-line bg-white/[0.03] p-4 backdrop-blur-xl sm:p-6 md:p-7">
            <h2 className="text-lg font-bold text-white sm:text-xl md:text-[22px]">Phương thức thanh toán</h2>
            <div className="mt-5 space-y-4">
              <div
                className={cn(
                  "rounded-card border p-5",
                  hasDigitalItems
                    ? "border-sky-400/20 bg-keyshop-blue/10"
                    : "border-keyshop-green/25 bg-keyshop-green/10",
                )}
              >
                <p className="font-bold text-white">
                  {hasDigitalItems
                    ? "Giỏ hàng yêu cầu thanh toán VNPay"
                    : "Hỗ trợ COD và VNPay"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm leading-relaxed",
                    hasDigitalItems ? "text-sky-200" : "text-green-200",
                  )}
                >
                  {hasDigitalItems
                    ? "Key và sản phẩm số chỉ giao sau khi thanh toán online thành công."
                    : "Giỏ hàng chỉ có sản phẩm vật lý — có thể chọn COD hoặc VNPay."}
                </p>
              </div>

              <div className="space-y-3">
                {allItemsAllowCod ? (
                  <label className="flex cursor-pointer gap-4 rounded-card border border-keyshop-line bg-white/[0.04] p-5 transition hover:border-keyshop-blue/40">
                    <input
                      type="radio"
                      name="payment"
                      className="mt-1 accent-keyshop-blue"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />
                    <div>
                      <p className="font-bold text-white">Thanh toán COD</p>
                      <p className="mt-1 text-sm text-keyshop-muted">
                        Thanh toán khi nhận hàng (sản phẩm vật lý).
                      </p>
                    </div>
                  </label>
                ) : null}

                <label className="flex cursor-pointer gap-4 rounded-card border border-keyshop-line bg-white/[0.04] p-5 transition hover:border-keyshop-blue/40">
                  <input
                    type="radio"
                    name="payment"
                    className="mt-1 accent-keyshop-blue"
                    checked={paymentMethod === "vnpay"}
                    onChange={() => setPaymentMethod("vnpay")}
                  />
                  <div>
                    <p className="font-bold text-white">VNPay</p>
                    <p className="mt-1 text-sm text-keyshop-muted">
                      Thanh toán an toàn qua cổng VNPay.
                    </p>
                  </div>
                </label>
              </div>

              {hasDigitalItems ? (
                <p className="text-[13px] leading-relaxed text-sky-300">
                  Key và mã nạp sẽ hiển thị trong tài khoản ngay sau khi thanh toán được xác nhận.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="h-fit rounded-card border border-keyshop-line bg-white/[0.03] p-4 backdrop-blur-xl sm:p-6 md:p-7 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-white">Tóm tắt đơn hàng</h2>
          <div className="mt-5 space-y-4">
            {cartItems.map((item) => (
              <div
                key={`${item.productId}-${item.variant?.id || "default"}`}
                className="flex gap-3 border-b border-keyshop-line pb-4 last:border-0 last:pb-0"
              >
                <div className="relative h-[90px] w-[90px] shrink-0 overflow-hidden rounded-[20px] bg-white/10">
                  <Image
                    src={getProductThumbnail(item.product)}
                    alt={getProductDisplayName(item.product)}
                    fill
                    className="object-cover"
                    sizes="90px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{getProductDisplayName(item.product)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-extrabold text-keyshop-muted">
                      SL: {item.quantity}
                    </span>
                    {item.variant ? (
                      <span className="rounded-full bg-keyshop-blue/15 px-2.5 py-1 text-xs font-extrabold text-sky-200">
                        {item.variant.name}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-extrabold text-keyshop-muted">
                      {getDeliveryLabel(item.product)}
                    </span>
                  </div>
                  <p className="mt-2 font-bold text-sky-400">
                    {formatPrice(getCartItemSalePrice(item) * item.quantity)}
                  </p>
                </div>
              </div>
            ))}

            <div className="space-y-2 border-t border-keyshop-line pt-5 text-sm">
              <OrderSummaryTotals
                cartSummary={cartSummary}
                effectiveCoupon={effectiveCoupon}
                totalClassName="text-lg font-bold text-white sm:text-xl md:text-[22px]"
              />
            </div>

            <button
              type="button"
              className={checkoutCtaClass}
              onClick={handlePlaceOrder}
              disabled={loading || cartItems.length === 0}
            >
              {loading ? "Đang xử lý..." : "Đặt hàng"}
            </button>

            <TrustSignals compact className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
