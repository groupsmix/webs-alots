import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText } from "lucide-react";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

const placeholderPosts = [
  {
    title: "Tips for Maintaining Good Health",
    excerpt: "Simple daily habits that can make a big difference in your overall well-being.",
    date: "2025-03-15",
  },
  {
    title: "Understanding Preventive Care",
    excerpt: "Why regular check-ups are essential for catching issues early.",
    date: "2025-03-10",
  },
  {
    title: "Healthy Eating on a Budget",
    excerpt: "Nutritious meal planning that won't break the bank.",
    date: "2025-03-05",
  },
];

export function BlogSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">
          Health Articles
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          Stay informed with the latest health tips and medical insights from
          our team.
        </p>
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {placeholderPosts.map((post) => (
            <Card key={post.title}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <FileText className="h-3.5 w-3.5" />
                  {post.date}
                </div>
                <h3 className="font-semibold mb-2">{post.title}</h3>
                <p className="text-sm text-muted-foreground">{post.excerpt}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/blog" className={linkBtnOutline}>
            View All Articles
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
