/**
 * Professional Services Section
 * Modern card grid with hover effects and icons
 */

'use client';

import {
  Activity,
  ArrowRight,
  Heart,
  Microscope,
  Pill,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const services = [
  {
    icon: Stethoscope,
    title: 'Consultation Générale',
    description: 'Examens médicaux complets et suivi personnalisé de votre santé',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Heart,
    title: 'Cardiologie',
    description: 'Diagnostic et traitement des maladies cardiovasculaires',
    color: 'from-red-500 to-pink-500',
    bgColor: 'bg-red-500/10',
  },
  {
    icon: Microscope,
    title: 'Analyses Médicales',
    description: 'Laboratoire moderne avec résultats rapides et fiables',
    color: 'from-purple-500 to-indigo-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Pill,
    title: 'Pharmacie',
    description: 'Médicaments de qualité et conseils pharmaceutiques',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Syringe,
    title: 'Vaccination',
    description: 'Programme complet de vaccination pour tous les âges',
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    icon: Activity,
    title: 'Urgences',
    description: 'Service d\'urgence disponible 24h/24 et 7j/7',
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-500/10',
  },
];

export function ServicesSectionPro() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Nos Services</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold">
            Des soins de qualité pour{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              toute la famille
            </span>
          </h2>
          
          <p className="text-lg text-muted-foreground">
            Une équipe médicale expérimentée et des équipements modernes pour votre bien-être
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map((service, index) => {
            const Icon = service.icon;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative"
              >
                <div className={`
                  glass-card p-8 h-full transition-all duration-300
                  ${isHovered ? 'shadow-strong scale-105' : 'shadow-soft'}
                `}>
                  {/* Icon */}
                  <div className={`
                    w-16 h-16 rounded-2xl ${service.bgColor} 
                    flex items-center justify-center mb-6
                    transition-transform duration-300
                    ${isHovered ? 'scale-110 rotate-3' : ''}
                  `}>
                    <Icon className={`w-8 h-8 bg-gradient-to-br ${service.color} bg-clip-text text-transparent`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                    {service.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Link */}
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all"
                  >
                    En savoir plus
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  {/* Hover Gradient Border */}
                  <div className={`
                    absolute inset-0 rounded-2xl bg-gradient-to-br ${service.color} opacity-0 
                    group-hover:opacity-20 transition-opacity duration-300 pointer-events-none
                  `} />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/services" className="btn-primary group">
            Voir tous nos services
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
