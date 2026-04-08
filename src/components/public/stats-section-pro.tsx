/**
 * Professional Stats Section
 * Animated counters with modern design
 */

'use client';

import { Award, Clock, Heart, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Stat {
  icon: typeof Users;
  value: number;
  suffix: string;
  label: string;
  color: string;
}

const stats: Stat[] = [
  {
    icon: Users,
    value: 15000,
    suffix: '+',
    label: 'Patients satisfaits',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Award,
    value: 25,
    suffix: '+',
    label: 'Années d\'expérience',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Heart,
    value: 98,
    suffix: '%',
    label: 'Taux de satisfaction',
    color: 'from-red-500 to-rose-500',
  },
  {
    icon: Clock,
    value: 24,
    suffix: '/7',
    label: 'Service disponible',
    color: 'from-green-500 to-emerald-500',
  },
];

function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, isVisible]);

  return { count, ref };
}

function StatCard({ stat }: { stat: Stat }) {
  const { count, ref } = useCountUp(stat.value);
  const Icon = stat.icon;

  return (
    <div ref={ref} className="group relative">
      <div className="glass-card p-8 text-center transition-all duration-300 hover:shadow-strong hover:scale-105">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6 group-hover:scale-110 transition-transform">
          <Icon className={`w-8 h-8 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`} />
        </div>

        {/* Number */}
        <div className="mb-2">
          <span className="text-5xl font-bold bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
            {count.toLocaleString()}
          </span>
          <span className={`text-3xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
            {stat.suffix}
          </span>
        </div>

        {/* Label */}
        <p className="text-muted-foreground font-medium">
          {stat.label}
        </p>

        {/* Hover Effect */}
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none`} />
      </div>
    </div>
  );
}

export function StatsSectionPro() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Des chiffres qui{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              parlent d'eux-mêmes
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            La confiance de milliers de patients depuis plus de 25 ans
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} />
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 items-center opacity-60">
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Certifié par</div>
            <div className="text-lg font-bold">Ministère de la Santé</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Membre de</div>
            <div className="text-lg font-bold">Ordre des Médecins</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Accrédité</div>
            <div className="text-lg font-bold">ISO 9001</div>
          </div>
        </div>
      </div>
    </section>
  );
}
