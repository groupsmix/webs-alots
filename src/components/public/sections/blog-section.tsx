import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText } from "lucide-react";
import { getPublicBlogPosts } from "@/lib/data/public";
import { formatDisplayDate } from "@/lib/utils";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

export async function BlogSection() {
  const blogPosts = await getPublicBlogPosts();
  const previewPosts = blogPosts.slice(0, 3);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">
          Articles Santé
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          Restez informé avec les derniers conseils santé et actualités
          médicales de notre équipe.
        </p>
        {previewPosts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {previewPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <FileText className="h-3.5 w-3.5" />
                    {formatDisplayDate(post.date, "fr", "long")}
                  </div>
                  <h3 className="font-semibold mb-2">{post.title}</h3>
                  <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Aucun article publié pour le moment. Revenez bientôt !
          </p>
        )}
        <div className="mt-10 text-center">
          <Link href="/blog" className={linkBtnOutline}>
            Voir tous les articles
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
