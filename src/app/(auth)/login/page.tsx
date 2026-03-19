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
import { signInWithOTP, verifyOTP } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInWithOTP(phone);

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
      // On success, verifyOTP redirects via server action
    } catch {
      // redirect() throws a NEXT_REDIRECT error — this is expected behavior
      router.refresh();
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          {step === "phone"
            ? "Enter your phone number to sign in."
            : "Enter the verification code sent to your phone."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <form className="space-y-4" onSubmit={handleSendOTP}>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Verification Code"}
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
              {loading ? "Verifying..." : "Verify & Sign In"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
            >
              Use a different number
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
          >
            Register
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
