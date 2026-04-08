/**
 * Professional Hero Section
 * Modern, engaging hero with glassmorphism and animations
 */

'use client';

import { ArrowRight, Calendar, Shield, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface HeroSectionProProps {
  clinicName?: string;
  tagline?: string;
  rating?: number;
  reviewCount?: number;
}

export function HeroSectionPro({
  clinicName = "Cabinet Médical",
  tagline = "Votre santé, notre priorité",
  rating = 4.8,
  reviewCount = 250,
}: HeroSectionProProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Animated Background Mesh */}
      <div className="absolute inset-0 gradient-mesh opacity-40" />
      
      {/* Floating Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Plateforme de santé moderne</span>
            </div>

            {/* Heading */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  {clinicName}
                </span>
              </h1>
              <p className="text-2xl md:text-3xl text-muted-foreground font-light">
                {tagline}
              </p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-muted text-muted'
                    }`}
                  />
                ))}
              </div>
              <div className="text-sm">
                <span className="font-bold text-lg">{rating}</span>
                <span className="text-muted-foreground"> / 5 ({reviewCount} avis)</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/book" className="btn-primary group">
                <Calendar className="w-5 h-5" />
                Prendre rendez-vous
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/services" className="btn-secondary">
                Découvrir nos services
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Sécurisé</div>
                  <div className="text-xs text-muted-foreground">Données protégées</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-info" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Disponible 24/7</div>
                  <div className="text-xs text-muted-foreground">Réservation en ligne</div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Element */}
          <div className={`relative transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
            <div className="relative">
              {/* Glass Card */}
              <div className="glass-card p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Prochain rendez-vous</span>
                    <span className="badge-success">Disponible</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">Aujourd'hui</div>
                        <div className="text-sm text-muted-foreground">14:30 - 15:00</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <div className="font-semibold">Demain</div>
                        <div className="text-sm text-muted-foreground">10:00 - 10:30</div>
                      </div>
                    </div>
                  </div>
                </div>

                <button className="w-full btn-primary">
                  Réserver maintenant
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl animate-pulse-glow" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/20 rounded-full blur-2xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="currentColor"
            className="text-background"
          />
        </svg>
      </div>
    </section>
  );
}
