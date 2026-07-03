import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductJsonLd } from "@/components/commerce/product-json-ld";
import ProductDetailView from "@/components/product/product-detail-view";
import { getProductById } from "@/lib/api/server";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const product = await getProductById(params.id);

    return {
      title: product.seoTitle || product.name,
      description: product.seoDescription || product.description,
      openGraph: {
        title: product.name,
        description: product.description,
        images: product.images?.length ? [product.images[0]] : [product.thumbnail],
        type: "website",
      },
    };
  } catch {
    return { title: "Sản phẩm" };
  }
}

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: Props) {
  try {
    const product = await getProductById(params.id);
    const slug = product.slug || product.id;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return (
      <>
        <ProductJsonLd product={product} url={`${baseUrl}/products/${slug}`} />
        <ProductDetailView product={product} />
      </>
    );
  } catch {
    notFound();
  }
}
