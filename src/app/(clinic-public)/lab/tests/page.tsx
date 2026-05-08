import { Clock, Droplets, AlertTriangle, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicLabTests, getLabTestCategories } from "@/lib/data/lab-public";

export const metadata: Metadata = {
  title: "Tests & Examens — Laboratoire",
  description: "Consultez notre catalogue complet d'analyses médicales et d'examens radiologiques avec instructions de préparation.",
};

export default async function LabTestsPage() {
  const allTests = await getPublicLabTests();
  const categories = getLabTestCategories(allTests);
  const activeTests = allTests.filter((t) => t.active);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Tests & Exams</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Browse our complete catalog of laboratory analyses and radiology exams.
          Each test includes preparation instructions to help you get accurate results.
        </p>
      </div>

      {activeTests.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No tests available at the moment. Please contact us for more information.</p>
        </div>
      ) : (
        categories.map((category) => {
          const categoryTests = activeTests.filter((t) => t.category === category);
          if (categoryTests.length === 0) return null;
          return (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold mb-6 capitalize flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-blue-600" />
                {category}
                <Badge variant="secondary" className="text-xs ml-2">
                  {categoryTests.length} test{categoryTests.length !== 1 ? "s" : ""}
                </Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryTests.map((test) => (
                  <Card key={test.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold">{test.name}</h3>
                        {test.requiresFasting && (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs shrink-0 ml-2">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Fasting
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{test.description}</p>

                      {test.preparationInstructions && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                            Preparation Instructions
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-300">
                            {test.preparationInstructions}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {test.turnaroundTime}
                          </span>
                          <span className="flex items-center gap-1 capitalize">
                            <Droplets className="h-3 w-3" />
                            {test.sampleType}
                          </span>
                        </div>
                        <span className="font-bold text-blue-600">
                          {test.price} {test.currency}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
