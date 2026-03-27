/**
 * Static blog content system for the root-domain (platform-level) blog.
 *
 * Blog posts are stored as plain TypeScript objects in `src/content/blog/`.
 * Each file default-exports a `BlogPost` object. This module re-exports
 * every post and provides helpers used by the listing and detail pages.
 */

// ── Types ──

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  category: BlogCategory;
  tags: string[];
  author: string;
  publishedAt: string; // ISO date string (YYYY-MM-DD)
  updatedAt?: string;
  readTime: string;
  content: string; // HTML content
  ogImage?: string;
}

export type BlogCategory =
  | "gestion-cabinet"
  | "dentaire"
  | "digital"
  | "communication"
  | "assurance";

export const BLOG_CATEGORIES: Record<BlogCategory, string> = {
  "gestion-cabinet": "Gestion de Cabinet",
  "dentaire": "Dentaire",
  "digital": "Digital & Innovation",
  "communication": "Communication Patient",
  "assurance": "Assurance & Facturation",
};

// ── Post registry ──

import post1 from "@/content/blog/logiciel-gestion-cabinet-medical-maroc";
import post2 from "@/content/blog/gestion-cabinet-dentaire-outils";
import post3 from "@/content/blog/prise-rendez-vous-en-ligne-maroc";
import post4 from "@/content/blog/whatsapp-medecins-communication-patient";
import post5 from "@/content/blog/cnss-cnops-gerer-assurances-cabinet";

const ALL_POSTS: BlogPost[] = [post1, post2, post3, post4, post5];

// ── Helpers ──

/** All published posts sorted by date (newest first). */
export function getAllPosts(): BlogPost[] {
  return [...ALL_POSTS].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

/** Single post by slug, or `undefined` if not found. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}

/** All unique categories that have at least one post. */
export function getCategories(): BlogCategory[] {
  const cats = new Set(ALL_POSTS.map((p) => p.category));
  return Array.from(cats);
}

/** Filter posts by category. */
export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

/** Simple search across title, excerpt, tags. */
export function searchPosts(query: string): BlogPost[] {
  const q = query.toLowerCase().trim();
  if (!q) return getAllPosts();
  return getAllPosts().filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}
