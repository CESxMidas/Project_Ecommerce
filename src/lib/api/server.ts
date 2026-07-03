import { cache } from "react";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { resolveMediaUrl } from "@/lib/utils/image";
import type { Banner, BlogPost, Category, Product } from "@/types/api";

function getServerApiBase() {
  if (process.env.API_INTERNAL_URL) {
    return `${process.env.API_INTERNAL_URL}/api`;
  }

  const publicUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

  if (publicUrl.startsWith("http")) {
    return publicUrl;
  }

  return `http://localhost:888/api`;
}

async function serverFetch<T>(
  path: string,
  options?: RequestInit & { revalidate?: number | false },
): Promise<T> {
  const { revalidate = 300, ...fetchOptions } = options || {};

  const response = await fetch(`${getServerApiBase()}${path}`, {
    ...fetchOptions,
    next: revalidate === false ? { revalidate: 0 } : { revalidate },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }

  return response.json() as Promise<T>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const rawThumbnail = String(raw.thumbnail || raw.image || asArray<string>(raw.images)[0] || "");
  const rawImages = asArray<string>(raw.images);
  const thumbnail = resolveMediaUrl(rawThumbnail);
  const images =
    rawImages.length > 0
      ? rawImages.map((image) => resolveMediaUrl(image, thumbnail))
      : thumbnail
        ? [thumbnail]
        : [];
  const id = String(raw.id ?? raw.productId ?? raw._id ?? "");

  return {
    id,
    name: String(raw.name || raw.title || ""),
    slug: String(raw.slug || ""),
    description: String(raw.description || ""),
    sku: String(raw.sku || ""),
    price: Number(raw.price ?? 0),
    salePrice: raw.salePrice != null ? Number(raw.salePrice) : null,
    listPrice: raw.listPrice != null ? Number(raw.listPrice) : null,
    thumbnail,
    images,
    categoryId: raw.categoryId != null ? String(raw.categoryId) : "",
    categoryName: String(raw.categoryName || ""),
    stock: Number(raw.stock ?? 0),
    rating: Number(raw.rating ?? 0),
    reviewsCount: Number(raw.reviewsCount ?? 0),
    badge: raw.badge ? String(raw.badge) : undefined,
    productType: String(raw.productType || "manual_service"),
    deliveryType: String(raw.deliveryType || "manual_delivery"),
    variants: asArray(raw.variants),
    seoTitle: raw.seoTitle ? String(raw.seoTitle) : undefined,
    seoDescription: raw.seoDescription ? String(raw.seoDescription) : undefined,
    tags: asArray<string>(raw.tags),
  };
}

function normalizeProductsPayload(data: unknown): {
  products: Product[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
} {
  if (Array.isArray(data)) {
    return {
      products: data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeProduct),
      total: data.length,
    };
  }

  const obj = asRecord(data);
  if (!obj) {
    return { products: [] };
  }

  const list = asArray<unknown>(obj.items ?? obj.products ?? obj.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);

  return {
    products: list.map(normalizeProduct),
    total: typeof obj.total === "number" ? obj.total : list.length,
    page: typeof obj.page === "number" ? obj.page : undefined,
    limit: typeof obj.limit === "number" ? obj.limit : undefined,
    totalPages: typeof obj.totalPages === "number" ? obj.totalPages : undefined,
  };
}

function normalizeCategory(raw: Record<string, unknown>): Category {
  return {
    id: String(raw.id ?? raw.categoryId ?? raw._id ?? ""),
    name: String(raw.name || ""),
    slug: String(raw.slug || ""),
    image: String(raw.image || ""),
    description: String(raw.description || ""),
    icon: String(raw.icon || ""),
    parentId: raw.parentId != null ? String(raw.parentId) : null,
    children: asArray<unknown>(raw.children)
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(normalizeCategory),
  };
}

function normalizeCategoriesPayload(data: unknown): { categories: Category[] } {
  if (Array.isArray(data)) {
    return {
      categories: data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeCategory),
    };
  }

  const obj = asRecord(data);
  if (!obj) {
    return { categories: [] };
  }

  const list = asArray<unknown>(obj.categories ?? obj.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);

  return { categories: list.map(normalizeCategory) };
}

function normalizeBanner(raw: Record<string, unknown>): Banner {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    title: String(raw.title || ""),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    image: resolveMediaUrl(String(raw.image || "")),
    link: raw.link ? String(raw.link) : undefined,
    order:
      typeof raw.sortOrder === "number"
        ? raw.sortOrder
        : typeof raw.order === "number"
          ? raw.order
          : undefined,
    placement: raw.placement ? String(raw.placement) : undefined,
  };
}

function normalizeBannersPayload(data: unknown): { banners: Banner[] } {
  if (Array.isArray(data)) {
    return {
      banners: data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeBanner),
    };
  }

  const obj = asRecord(data);
  if (!obj) {
    return { banners: [] };
  }

  const list = asArray<unknown>(obj.banners ?? obj.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);

  return { banners: list.map(normalizeBanner) };
}

function normalizeBlog(raw: Record<string, unknown>): BlogPost {
  const description = String(raw.description || "");

  return {
    id: String(raw.id ?? raw._id ?? ""),
    title: String(raw.title || ""),
    slug: String(raw.slug || ""),
    excerpt: String(raw.excerpt || raw.summary || description || ""),
    content: String(raw.content || description || ""),
    image: resolveMediaUrl(String(raw.image || raw.thumbnail || "")),
    author: raw.author ? String(raw.author) : undefined,
    category: raw.category ? String(raw.category) : undefined,
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
  };
}

function normalizeBlogsPayload(data: unknown): { blogs: BlogPost[] } {
  if (Array.isArray(data)) {
    return {
      blogs: data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeBlog),
    };
  }

  const obj = asRecord(data);
  if (!obj) {
    return { blogs: [] };
  }

  const list = asArray<unknown>(obj.blogs ?? obj.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);

  return { blogs: list.map(normalizeBlog) };
}

export async function getProducts(params?: Record<string, string>) {
  const queryParams = {
    page: "1",
    limit: "12",
    ...params,
  };
  const query = `?${new URLSearchParams(queryParams).toString()}`;

  const data = await serverFetch<unknown>(
    `${API_ENDPOINTS.products.list}${query}`,
    { revalidate: false },
  );

  return normalizeProductsPayload(data);
}

export async function getProductById(id: string) {
  const data = await serverFetch<unknown>(API_ENDPOINTS.products.detail(id), {
    revalidate: false,
  });
  const raw = asRecord(data);

  if (!raw) {
    throw new Error("Invalid product response");
  }

  return normalizeProduct(raw);
}

async function fetchCategoriesFromApi() {
  const data = await serverFetch<unknown>(API_ENDPOINTS.categories.list, {
    revalidate: 600,
  });

  return normalizeCategoriesPayload(data);
}

/** Dedupe categories fetch trong cùng request (home + products + …) */
export const getCategories = cache(fetchCategoriesFromApi);

export async function getBanners() {
  const data = await serverFetch<unknown>(API_ENDPOINTS.banners.list, {
    revalidate: 300,
  });

  return normalizeBannersPayload(data);
}

export async function getBlogs() {
  const data = await serverFetch<unknown>(API_ENDPOINTS.blogs.list, {
    revalidate: 300,
  });

  return normalizeBlogsPayload(data);
}

export async function getBlogById(id: string) {
  const data = await serverFetch<unknown>(API_ENDPOINTS.blogs.detail(id), {
    revalidate: 300,
  });
  const raw = asRecord(data);

  if (!raw) {
    throw new Error("Invalid blog response");
  }

  return normalizeBlog(raw);
}
