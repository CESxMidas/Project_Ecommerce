import type { Metadata } from "next";

import HomeView from "@/components/home/home-view";
import { getBanners, getBlogs, getCategories, getProducts } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "KEYSHOP | Key phần mềm & bản quyền số",
  description:
    "Mua key game, phần mềm và bản quyền số với giao hàng tức thì sau thanh toán. Thanh toán VNPay an toàn.",
  openGraph: {
    title: "KEYSHOP — Bản quyền số chính hãng",
    description: "Key phần mềm, game và công cụ số — giao ngay sau thanh toán.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [productsRes, categoriesRes, bannersRes, blogsRes] = await Promise.allSettled([
    getProducts({ limit: "24" }),
    getCategories(),
    getBanners(),
    getBlogs(),
  ]);

  const products =
    productsRes.status === "fulfilled" ? productsRes.value.products : [];
  const categories =
    categoriesRes.status === "fulfilled" ? categoriesRes.value.categories : [];
  const banners =
    bannersRes.status === "fulfilled" ? bannersRes.value.banners : [];
  const blogs = blogsRes.status === "fulfilled" ? blogsRes.value.blogs : [];

  return (
    <HomeView
      products={products}
      categories={categories}
      banners={banners}
      blogs={blogs}
    />
  );
}
