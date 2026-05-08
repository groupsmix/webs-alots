"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-orange-600" };
  return { label: "Obese", color: "text-red-600" };
}

export default function BMIPage() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const bmi = weight && height
    ? (parseFloat(weight) / ((parseFloat(height) / 100) ** 2))
    : null;

  const validBMI = bmi && isFinite(bmi) && bmi > 0 ? bmi : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">BMI Calculator</h1>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calculate Body Mass Index</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 70" className="mt-1" />
            </div>
            <div>
              <Label>Height (cm)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 170" className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {validBMI && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Your BMI</p>
              <p className={`text-5xl font-bold ${getBMICategory(validBMI).color}`}>
                {validBMI.toFixed(1)}
              </p>
              <Badge variant="outline" className={`mt-3 text-sm ${getBMICategory(validBMI).color}`}>
                {getBMICategory(validBMI).label}
              </Badge>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">BMI Reference Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="font-bold text-blue-600">&lt;18.5</p>
                <p className="text-xs text-muted-foreground mt-1">Underweight</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="font-bold text-green-600">18.5–24.9</p>
                <p className="text-xs text-muted-foreground mt-1">Normal</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <p className="font-bold text-orange-600">25–29.9</p>
                <p className="text-xs text-muted-foreground mt-1">Overweight</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="font-bold text-red-600">&ge;30</p>
                <p className="text-xs text-muted-foreground mt-1">Obese</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
