"use client";

import {
  Apple, Plus, Trash2, ChevronDown, ChevronUp, Utensils,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MealPlan, MealItem } from "@/lib/types/para-medical";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "outline"> = {
  active: "default",
  completed: "success",
  draft: "secondary",
};

const MEAL_SLOTS = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  morning_snack: "Morning Snack",
  lunch: "Lunch",
  afternoon_snack: "Afternoon Snack",
  dinner: "Dinner",
};

interface MealPlanBuilderProps {
  plans: MealPlan[];
  editable?: boolean;
  onAddMealItem?: (planId: string, dayIndex: number, slot: string, item: MealItem) => void;
  onRemoveMealItem?: (planId: string, dayIndex: number, slot: string, itemIndex: number) => void;
}

const EMPTY_ITEM: MealItem = {
  name: "",
  quantity: "1 serving",
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};

export function MealPlanBuilder({ plans, editable = false, onAddMealItem, onRemoveMealItem }: MealPlanBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(plans[0]?.id ?? null);
  const [expandedDay, setExpandedDay] = useState<number>(0);
  const [addingSlot, setAddingSlot] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);

  const handleAdd = (planId: string, dayIndex: number, slot: string) => {
    if (newItem.name.trim() && onAddMealItem) {
      onAddMealItem(planId, dayIndex, slot, { ...newItem, name: newItem.name.trim() });
      setNewItem(EMPTY_ITEM);
      setAddingSlot(null);
    }
  };

  return (
    <div className="space-y-4">
      {plans.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No meal plans yet.</p>
      )}
      {plans.map((plan) => {
        const isExpanded = expandedId === plan.id;
        const currentDay = plan.daily_plans[expandedDay];
        return (
          <Card key={plan.id}>
            <CardHeader className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : plan.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Apple className="h-5 w-5 text-green-600" />
                  <div>
                    <CardTitle className="text-sm">{plan.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.patient_name} &middot; {plan.type} plan &middot; Target: {plan.target_calories} kcal
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[plan.status]} className="text-xs">{plan.status}</Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                {/* Day tabs */}
                {plan.daily_plans.length > 1 && (
                  <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                    {plan.daily_plans.map((dp, i) => (
                      <button
                        key={i}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                          expandedDay === i ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
                        }`}
                        onClick={() => setExpandedDay(i)}
                      >
                        {dp.day || `Day ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                {currentDay && (
                  <div className="space-y-4">
                    {/* Macros summary */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                        <p className="text-lg font-bold text-orange-600">{currentDay.total_calories}</p>
                        <p className="text-[10px] text-muted-foreground">Calories</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <p className="text-lg font-bold text-red-600">{currentDay.total_protein}g</p>
                        <p className="text-[10px] text-muted-foreground">Protein</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-lg font-bold text-blue-600">{currentDay.total_carbs}g</p>
                        <p className="text-[10px] text-muted-foreground">Carbs</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                        <p className="text-lg font-bold text-yellow-600">{currentDay.total_fat}g</p>
                        <p className="text-[10px] text-muted-foreground">Fat</p>
                      </div>
                    </div>

                    {/* Meal slots */}
                    {MEAL_SLOTS.map((slot) => {
                      const items = currentDay[slot] as MealItem[];
                      return (
                        <div key={slot} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium">{MEAL_LABELS[slot]}</h4>
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              {items.reduce((s, i) => s + i.calories, 0)} kcal
                            </Badge>
                          </div>
                          {items.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No items</p>
                          ) : (
                            <div className="space-y-1">
                              {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs py-1">
                                  <span className="flex-1">{item.name}</span>
                                  <span className="text-muted-foreground">{item.quantity}</span>
                                  <span className="w-14 text-right">{item.calories} kcal</span>
                                  {editable && (
                                    <button onClick={() => onRemoveMealItem?.(plan.id, expandedDay, slot, idx)}>
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {editable && (
                            <>
                              {addingSlot === `${plan.id}-${expandedDay}-${slot}` ? (
                                <div className="mt-2 space-y-2 p-2 border rounded bg-muted/30">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[10px]">Food Item</Label>
                                      <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Oatmeal" className="text-xs h-8" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px]">Quantity</Label>
                                      <Input value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} className="text-xs h-8" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1">
                                    <div>
                                      <Label className="text-[10px]">Cal</Label>
                                      <Input type="number" value={newItem.calories} onChange={(e) => setNewItem({ ...newItem, calories: +e.target.value })} className="text-xs h-8" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px]">Protein</Label>
                                      <Input type="number" value={newItem.protein_g} onChange={(e) => setNewItem({ ...newItem, protein_g: +e.target.value })} className="text-xs h-8" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px]">Carbs</Label>
                                      <Input type="number" value={newItem.carbs_g} onChange={(e) => setNewItem({ ...newItem, carbs_g: +e.target.value })} className="text-xs h-8" />
                                    </div>
                                    <div>
                                      <Label className="text-[10px]">Fat</Label>
                                      <Input type="number" value={newItem.fat_g} onChange={(e) => setNewItem({ ...newItem, fat_g: +e.target.value })} className="text-xs h-8" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleAdd(plan.id, expandedDay, slot)}>Add</Button>
                                    <Button size="sm" variant="outline" onClick={() => setAddingSlot(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={() => { setAddingSlot(`${plan.id}-${expandedDay}-${slot}`); setNewItem(EMPTY_ITEM); }}
                                >
                                  <Plus className="h-3 w-3" /> Add item
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
