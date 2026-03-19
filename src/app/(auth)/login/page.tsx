"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [step, setStep] = useState<"phone" | "otp">("phone");

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          {step === "phone"
            ? "Enter your phone number or email to sign in."
            : "Enter the verification code sent to your phone."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "phone" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("otp");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number or Email</Label>
              <Input
                id="phone"
                placeholder="+212 6XX XX XX XX"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Verification Code
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                A code was sent via WhatsApp to your phone number.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Verify & Sign In
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("phone")}
            >
              Use a different number
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Register
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
