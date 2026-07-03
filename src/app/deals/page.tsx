import type { Metadata } from "next";
import { Suspense } from "react";

import ProductListing from "@/components/shop/product-listing";
import { ProductListingSkeleton } from "@/components/ui/skeleton";
import { getCategories, getProducts } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Ưu đãi",
  description: "Ưu đãi đặc biệt cho sản phẩm số và key bản quyền.",
};

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [productsRes, categoriesRes] = await Promise.allSettled([
    getProducts(),
    getCategories(),
  ]);

  const products =
    productsRes.status === "fulfilled" ? productsRes.value.products : [];
  const categories =
    categoriesRes.status === "fulfilled" ? categoriesRes.value.categories : [];

  return (
    <Suspense fallback={<ProductListingSkeleton />}>
      <ProductListing products={products} categories={categories} mode="deals" />
    </Suspense>
  );
}
