import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import ProductListing from "@/components/shop/product-listing";
import { ProductListingSkeleton } from "@/components/ui/skeleton";
import { getCategories, getProducts } from "@/lib/api/server";
import { pageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { categories } = await getCategories();
    const match = categories.find(
      (c) => c.slug === params.slug || String(c.id) === params.slug,
    );
    if (match) {
      return pageMetadata(match.name, match.description || `Sản phẩm ${match.name} tại KEYSHOP.`);
    }
  } catch {
    /* fallback */
  }
  return pageMetadata("Danh mục", "Sản phẩm theo danh mục tại KEYSHOP.");
}

export default async function CategoryPage({ params }: Props) {
  const { categories } = await getCategories().catch(() => ({ categories: [] }));
  const match = categories.find(
    (c) => c.slug === params.slug || String(c.id) === params.slug,
  );

  if (!match?.slug) {
    notFound();
  }

  if (match.slug !== params.slug) {
    redirect(`/categories/${match.slug}`);
  }

  const productsPayload = await getProducts({
    category: match.slug,
    page: "1",
    limit: "12",
  }).catch(() => ({
    products: [],
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 12,
  }));

  return (
    <Suspense fallback={<ProductListingSkeleton />}>
      <ProductListing
        products={productsPayload.products}
        categories={categories}
        pagination={{
          page: productsPayload.page ?? 1,
          totalPages: productsPayload.totalPages ?? 1,
          totalItems: productsPayload.total ?? productsPayload.products.length,
          limit: productsPayload.limit ?? 12,
        }}
      />
    </Suspense>
  );
}
