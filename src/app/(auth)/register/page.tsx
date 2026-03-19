"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { registerPatient, verifyOTP } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"info" | "otp">("info");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [insurance, setInsurance] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await registerPatient({
      phone,
      name: `${firstName} ${lastName}`.trim(),
      email: email || undefined,
      age: age ? parseInt(age, 10) : undefined,
      gender: gender || undefined,
      insurance: insurance || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setStep("otp");
    setLoading(false);
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOTP(phone, otp);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch {
      // redirect() throws a NEXT_REDIRECT error — this is expected behavior
      router.refresh();
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>
          {step === "info"
            ? "Register as a new patient to book appointments and access your portal."
            : "Enter the verification code sent to your phone."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "info" ? (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+212 6XX XX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="30"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance">Insurance Provider (optional)</Label>
              <select
                id="insurance"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
              >
                <option value="">No insurance</option>
                <option value="CNSS">CNSS</option>
                <option value="CNOPS">CNOPS</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleVerifyOTP}>
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-lg tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                A verification code was sent to {phone}.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify & Complete Registration"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("info");
                setOtp("");
                setError(null);
              }}
            >
              Back to registration
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline font-medium"
          >
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
