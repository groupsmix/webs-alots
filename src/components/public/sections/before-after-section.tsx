import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

export function BeforeAfterSection() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">
          Before &amp; After
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          See the results of our treatments. Real patients, real
          transformations.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                      <span className="text-[10px] text-muted-foreground">
                        Before
                      </span>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                      <span className="text-[10px] text-muted-foreground">
                        After
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Treatment result #{i}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
