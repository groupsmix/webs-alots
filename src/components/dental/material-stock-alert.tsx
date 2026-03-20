"use client";

import { Package, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MaterialStock } from "@/lib/dental-demo-data";

interface MaterialStockAlertProps {
  stock: MaterialStock[];
}

export function MaterialStockAlert({ stock }: MaterialStockAlertProps) {
  const lowStockItems = stock.filter((item) => item.quantity <= item.minThreshold);
  const normalStockItems = stock.filter((item) => item.quantity > item.minThreshold);

  return (
    <div className="space-y-4">
      {lowStockItems.length > 0 && (
        <Card className="border-red-300 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alert ({lowStockItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900 p-3 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category} &middot; {item.supplier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="text-xs">
                      {item.quantity} {item.unit}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Min: {item.minThreshold}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            All Materials ({stock.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {normalStockItems.map((item) => {
              const fillPercentage = Math.min(100, (item.quantity / (item.minThreshold * 3)) * 100);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
