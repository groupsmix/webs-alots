'use client';

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { defaultWebsiteConfig } from "@/lib/website-config";

interface HeroOverrides {
  title?: string;
  subtitle?: string;
}

interface HeroSectionProps {
  overrides?: HeroOverrides;
}

export function HeroSection({ overrides }: HeroSectionProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  const cfg = {
    ...defaultWebsiteConfig.hero,
    ...overrides,
  };

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-60" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-success/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className={`text-center lg:text-left transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-accent">
              {cfg.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground lg:mx-0">
              {cfg.subtitle}
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 lg:justify-start">
              <Link href="/book" className="btn-primary">
                {cfg.ctaPrimary}
              </Link>
              <Link href="/services" className="btn-secondary">
                {cfg.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className={`hidden lg:flex justify-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            {cfg.imageUrl ? (
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary via-accent to-success rounded-3xl blur-2xl opacity-30 animate-pulse-glow" />
                <Image
                  src={cfg.imageUrl}
                  alt="Clinic"
                  width={500}
                  height={384}
                  className="relative rounded-2xl shadow-strong max-h-96 object-cover glass-card"
                />
              </div>
            ) : (
              <div className="relative h-80 w-full max-w-md" aria-hidden="true">
                {/* Glassmorphic container */}
                <div className="absolute inset-0 glass-card shadow-strong" />
                
                <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full relative z-10">
                  {/* Decorative gradient orbs */}
                  <defs>
                    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="oklch(0.55 0.18 240)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="oklch(0.65 0.18 145)" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  
                  <circle cx="420" cy="60" r="50" fill="url(#primaryGrad)" className="animate-float" />
                  <circle cx="80" cy="350" r="40" fill="url(#accentGrad)" className="animate-float" style={{ animationDelay: '1s' }} />

                  {/* Modern stethoscope icon with glow */}
                  <g transform="translate(200, 50)">
                    <circle cx="50" cy="50" r="48" className="fill-primary/15 animate-pulse-glow" />
                    <circle cx="50" cy="50" r="42" className="fill-primary/10" />
                    <path d="M35 35 C35 25, 45 20, 50 20 C55 20, 65 25, 65 35 L65 55" className="stroke-primary" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M35 35 L35 55" className="stroke-primary" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <circle cx="50" cy="65" r="10" className="stroke-primary" strokeWidth="3" fill="none" />
                    <circle cx="65" cy="58" r="4" className="fill-primary animate-pulse" />
                  </g>

                  {/* Glassmorphic appointment cards */}
                  <g transform="translate(85, 155)">
                    <rect width="330" height="70" rx="16" className="fill-background/70" style={{ backdropFilter: 'blur(12px)' }} />
                    <rect width="330" height="70" rx="16" className="stroke-primary/20" strokeWidth="1" fill="none" />
                    
                    <rect x="16" y="15" width="40" height="40" rx="10" className="fill-primary/20" />
                    <rect x="22" y="25" width="28" height="3" rx="1.5" className="fill-primary" />
                    <rect x="22" y="32" width="28" height="3" rx="1.5" className="fill-primary" />
                    <rect x="22" y="39" width="16" height="3" rx="1.5" className="fill-primary" />
                    
                    <rect x="68" y="20" width="130" height="10" rx="5" className="fill-primary/40" />
                    <rect x="68" y="38" width="90" height="8" rx="4" className="fill-primary/20" />
                    
                    <rect x="250" y="22" width="64" height="26" rx="13" className="fill-primary shadow-soft" />
                    <text x="282" y="40" textAnchor="middle" className="fill-primary-foreground" fontSize="12" fontWeight="700">09:00</text>
                  </g>

                  <g transform="translate(85, 240)">
                    <rect width="330" height="70" rx="16" className="fill-background/70" style={{ backdropFilter: 'blur(12px)' }} />
                    <rect width="330" height="70" rx="16" className="stroke-success/20" strokeWidth="1" fill="none" />
                    
                    <rect x="16" y="15" width="40" height="40" rx="10" className="fill-success/20" />
                    <circle cx="36" cy="30" r="7" className="fill-success/50" />
                    <path d="M28 45 C28 40 32 37 36 37 C40 37 44 40 44 45" className="fill-success/50" />
                    
                    <rect x="68" y="20" width="110" height="10" rx="5" className="fill-success/40" />
                    <rect x="68" y="38" width="70" height="8" rx="4" className="fill-success/20" />
                    
                    <rect x="250" y="22" width="64" height="26" rx="13" className="fill-success shadow-soft" />
                    <text x="282" y="40" textAnchor="middle" className="fill-success-foreground" fontSize="12" fontWeight="700">10:30</text>
                  </g>

                  {/* Modern stats with glassmorphism */}
                  <g transform="translate(85, 325)">
                    <rect width="100" height="50" rx="12" className="fill-primary/15 shadow-soft" />
                    <text x="50" y="26" textAnchor="middle" className="fill-primary" fontSize="16" fontWeight="800">24</text>
                    <text x="50" y="40" textAnchor="middle" className="fill-primary/70" fontSize="9" fontWeight="600">Patients</text>

                    <rect x="115" y="0" width="100" height="50" rx="12" className="fill-success/15 shadow-soft" />
                    <text x="165" y="26" textAnchor="middle" className="fill-success" fontSize="16" fontWeight="800">98%</text>
                    <text x="165" y="40" textAnchor="middle" className="fill-success/70" fontSize="9" fontWeight="600">Satisfaction</text>

                    <rect x="230" y="0" width="100" height="50" rx="12" className="fill-accent/15 shadow-soft" />
                    <text x="280" y="26" textAnchor="middle" className="fill-accent" fontSize="16" fontWeight="800">15+</text>
                    <text x="280" y="40" textAnchor="middle" className="fill-accent/70" fontSize="9" fontWeight="600">Services</text>
                  </g>

                  {/* Animated pulse indicators */}
                  <circle cx="400" cy="170" r="6" className="fill-success animate-pulse" />
                  <circle cx="400" cy="170" r="12" className="stroke-success/40 animate-ping" strokeWidth="2" fill="none" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
