import type { Metadata } from "next";
import { Clock, Tag } from "lucide-react";
import { blogPosts } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Blog Santé",
  description:
    "Articles et conseils santé de notre équipe médicale. Restez informé avec nos dernières publications sur le bien-être et la prévention.",
  openGraph: {
    title: "Blog Santé",
    description: "Articles et conseils santé de notre équipe médicale.",
  },
};

// Blog posts don't have a DB table yet — uses demo data until a blog_posts table or CMS is added
export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Health Blog</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Stay informed with the latest health tips, medical advice, and
          wellness articles from our team.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {blogPosts.map((post) => (
          <Card key={post.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {post.category}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
              </div>
              <CardTitle>{post.title}</CardTitle>
              <CardDescription>{post.excerpt}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Published on {post.date}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
