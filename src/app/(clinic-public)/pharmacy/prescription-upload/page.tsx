"use client";

import {
  Upload, Camera, FileText, Check, AlertCircle,
  Truck, MapPin, Phone, MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PrescriptionUploadPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    deliveryOption: "pickup" as "pickup" | "delivery",
    deliveryAddress: "",
    notes: "",
    isChronic: false,
  });
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto mb-6">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Prescription Uploaded!</h1>
        <p className="text-muted-foreground mb-6">
          Your prescription has been submitted successfully. Our pharmacist will
          review it shortly and notify you via WhatsApp when your medications are ready.
        </p>
        <div className="bg-muted rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold mb-2">What happens next?</h3>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-emerald-600">1.</span>
              Our pharmacist reviews your prescription
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-emerald-600">2.</span>
              We check medication availability
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-emerald-600">3.</span>
              You receive a WhatsApp notification with status
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-emerald-600">4.</span>
              {formData.deliveryOption === "delivery"
                ? "We deliver to your address"
                : "Pick up your medications at the pharmacy"}
            </li>
          </ol>
        </div>
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setStep(1);
              setPrescriptionFile(null);
              setFormData({
                name: "",
                phone: "",
                deliveryOption: "pickup",
                deliveryAddress: "",
                notes: "",
                isChronic: false,
              });
            }}
          >
            Upload Another
          </Button>
          <a
            href="/pharmacy/prescription-history"
            className="inline-flex items-center justify-center rounded-lg px-2.5 h-8 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            View History
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Upload Prescription</h1>
      <p className="text-muted-foreground mb-8">
        Upload a photo of your prescription and we&apos;ll prepare your medications
      </p>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[
          { num: 1, label: "Upload" },
          { num: 2, label: "Details" },
          { num: 3, label: "Confirm" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s.num
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.num ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-sm hidden sm:inline ${step >= s.num ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {s.num < 3 && <div className="w-8 h-px bg-muted-foreground/30" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Upload Prescription Photo</h2>
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                prescriptionFile
                  ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/10"
                  : "border-muted-foreground/20 hover:border-emerald-300"
              }`}
            >
              {prescriptionFile ? (
                <div>
                  <FileText className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                  <p className="font-semibold">{prescriptionFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(prescriptionFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-3 text-red-500"
                    onClick={() => setPrescriptionFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-semibold mb-2">Drag & drop your prescription photo</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse (JPG, PNG, PDF - Max 10MB)
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPrescriptionFile(new File(["demo"], "prescription.jpg", { type: "image/jpeg" }));
                      }}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPrescriptionFile(new File(["demo"], "prescription.jpg", { type: "image/jpeg" }));
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Browse Files
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 mt-4 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Make sure the prescription is clearly visible with doctor&apos;s name, medications,
                and patient information. We only accept valid prescriptions from licensed doctors.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!prescriptionFile}
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Patient Details */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Your Details</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number (WhatsApp)</Label>
                <Input
                  id="phone"
                  placeholder="+212 6 XX XX XX XX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  We&apos;ll send status updates via WhatsApp
                </p>
              </div>

              {/* Delivery Option */}
              <div>
                <Label>Collection Method</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={() => setFormData({ ...formData, deliveryOption: "pickup" })}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      formData.deliveryOption === "pickup"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/10"
                        : "border-muted hover:border-emerald-300"
                    }`}
                  >
                    <MapPin className="h-5 w-5 mb-2 text-emerald-600" />
                    <p className="font-medium text-sm">Pickup</p>
                    <p className="text-xs text-muted-foreground">Collect at pharmacy</p>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, deliveryOption: "delivery" })}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      formData.deliveryOption === "delivery"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/10"
                        : "border-muted hover:border-emerald-300"
                    }`}
                  >
                    <Truck className="h-5 w-5 mb-2 text-emerald-600" />
                    <p className="font-medium text-sm">Delivery</p>
                    <p className="text-xs text-muted-foreground">20 MAD delivery fee</p>
                  </button>
                </div>
              </div>

              {formData.deliveryOption === "delivery" && (
                <div>
                  <Label htmlFor="address">Delivery Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter your full delivery address"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chronic"
                  checked={formData.isChronic}
                  onChange={(e) => setFormData({ ...formData, isChronic: e.target.checked })}
                  className="rounded border-muted-foreground/30"
                />
                <Label htmlFor="chronic" className="text-sm cursor-pointer">
                  This is for a chronic condition (set up refill reminders)
                </Label>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions or information..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!formData.name || !formData.phone}
                onClick={() => setStep(3)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Confirm & Submit</h2>
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collection</span>
                    <Badge variant="outline" className="capitalize">
                      {formData.deliveryOption === "delivery" ? (
                        <><Truck className="h-3 w-3 mr-1" /> Delivery</>
                      ) : (
                        <><MapPin className="h-3 w-3 mr-1" /> Pickup</>
                      )}
                    </Badge>
                  </div>
                  {formData.deliveryOption === "delivery" && formData.deliveryAddress && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[200px]">{formData.deliveryAddress}</span>
                    </div>
                  )}
                  {formData.isChronic && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chronic</span>
                      <Badge className="bg-blue-100 text-blue-700">Refill reminders enabled</Badge>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prescription</span>
                    <span className="font-medium">{prescriptionFile?.name}</span>
                  </div>
                  {formData.notes && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground">Notes: </span>
                      <span>{formData.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/10 rounded-lg">
                <Phone className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  You will receive a WhatsApp notification at <strong>{formData.phone}</strong> when
                  your prescription is reviewed and medications are ready.
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSubmit}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Submit Prescription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
