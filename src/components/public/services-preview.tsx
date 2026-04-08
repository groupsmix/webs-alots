'use client';

import { ArrowRight, Stethoscope, Heart, Activity, Brain, Eye, Bone, Pill } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const serviceIcons = [Stethoscope, Heart, Activity, Brain, Eye, Bone];

const gradients = [
  'from-primary via-primary/80 to-primary/60',
  'from-accent via-accent/80 to-accent/60',
  'from-success via-success/80 to-success/60',
  'from-warning via-warning/80 to-warning/60',
  'from-info via-info/80 to-info/60',
  'from-primary via-accent to-success',
];

interface Service {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

interface ServicesPreviewProps {
  services: Service[];
}

export function ServicesPreview({ services }: ServicesPreviewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeServices = services.filter((s) => s.active).slice(0, 6);

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 gradient-mesh opacity-40" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-accent">
            Nos Services
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Des soins de qualité adaptés à vos besoins
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {activeServices.length > 0 ? (
            activeServices.map((service, idx) => {
              const Icon = serviceIcons[idx % serviceIcons.length];
              const gradient = gradients[idx % gradients.length];
              const isHovered = hoveredIndex === idx;
              
              return (
                <div
                  key={service.id}
                  role="button"
                  tabIndex={0}
                  className={`group relative glass-card p-8 text-center transition-all duration-500 cursor-pointer ${
                    isHovered ? 'scale-105 shadow-strong' : 'shadow-medium hover:shadow-strong'
                  }`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setHoveredIndex(idx);
                    }
                  }}
                >
                  {/* Animated gradient background on hover */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  {/* Icon with glow effect */}
                  <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500`} />
                    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-medium`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
                    {service.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                  
                  {/* Hover indicator */}
                  <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-xs font-semibold text-primary">En savoir plus →</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-12">
              <div className="glass-card p-8 max-w-md mx-auto">
                <Pill className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Aucun service disponible pour le moment.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-12 text-center">
          <Link href="/services" className="btn-primary inline-flex items-center gap-2">
            Voir tous les services
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
