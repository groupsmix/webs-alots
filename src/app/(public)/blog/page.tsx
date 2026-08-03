import type { Metadata } from "next";
import { BlogSearch } from "@/components/blog/blog-search";
import { getAllPosts, getCategories } from "@/lib/blog";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Blog Santé — Articles et Conseils Médicaux",
  description:
    "Articles, guides et conseils pour les professionnels de santé au Maroc. Gestion de cabinet, digitalisation, communication patient et assurances.",
  path: "/blog",
});

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Blog Sante</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Guides, conseils et bonnes pratiques pour les professionnels de sante au Maroc. Gestion de
          cabinet, outils numeriques, communication patient et bien plus.
        </p>
      </div>

      <BlogSearch posts={posts} categories={categories} />
    </div>
  );
}
