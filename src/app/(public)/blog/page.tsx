import type { Metadata } from "next";
import { getAllPosts, getCategories } from "@/lib/blog";
import { BlogSearch } from "@/components/blog/blog-search";

export const metadata: Metadata = {
  title: "Blog Sante — Articles et Conseils Medicaux",
  description:
    "Articles, guides et conseils pour les professionnels de sante au Maroc. Gestion de cabinet, digitalisation, communication patient et assurances.",
  openGraph: {
    title: "Blog Sante — Articles et Conseils Medicaux",
    description:
      "Articles, guides et conseils pour les professionnels de sante au Maroc.",
    type: "website",
    locale: "fr_MA",
  },
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Blog Sante</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Guides, conseils et bonnes pratiques pour les professionnels de sante
          au Maroc. Gestion de cabinet, outils numeriques, communication patient
          et bien plus.
        </p>
      </div>

      <BlogSearch posts={posts} categories={categories} />
    </div>
  );
}
