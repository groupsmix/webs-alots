import { MaterialStockAlert } from "@/components/dental/material-stock-alert";
import { materialStock } from "@/lib/dental-demo-data";

export default function DoctorStockPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Material Stock</h1>
      <MaterialStockAlert stock={materialStock} />
    </div>
  );
}
