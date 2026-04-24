"use client";

/**
 * Landing Page Builder Component
 *
 * Drag-and-drop section reordering for clinic landing pages.
 * Each section can be toggled, reordered, and has editable content.
 */

import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Settings,
  Save,
} from "lucide-react";
import { useState, useCallback } from "react";

// ---- Types ----

export interface LandingSection {
  id: string;
  type:
    | "hero"
    | "services"
    | "about"
    | "team"
    | "testimonials"
    | "contact"
    | "location"
    | "faq"
    | "gallery"
    | "cta";
  title: string;
  visible: boolean;
  content?: Record<string, string>;
}

interface LandingPageBuilderProps {
  sections: LandingSection[];
  onSave: (sections: LandingSection[]) => void;
  className?: string;
}

const SECTION_LABELS: Record<LandingSection["type"], { label: string; description: string }> = {
  hero: { label: "Hero Banner", description: "Main banner with headline and CTA" },
  services: { label: "Services", description: "List of clinic services" },
  about: { label: "About Us", description: "Clinic description and values" },
  team: { label: "Our Team", description: "Doctor and staff profiles" },
  testimonials: { label: "Testimonials", description: "Patient reviews and ratings" },
  contact: { label: "Contact", description: "Contact form and information" },
  location: { label: "Location", description: "Map and address" },
  faq: { label: "FAQ", description: "Frequently asked questions" },
  gallery: { label: "Gallery", description: "Photo gallery" },
  cta: { label: "Call to Action", description: "Booking prompt" },
};

// ---- Component ----

export function LandingPageBuilder({
  sections: initialSections,
  onSave,
  className,
}: LandingPageBuilderProps) {
  const [sections, setSections] = useState<LandingSection[]>(initialSections);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const moveSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= sections.length) return;
      const updated = [...sections];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setSections(updated);
      setHasChanges(true);
    },
    [sections],
  );

  const toggleVisibility = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
    setHasChanges(true);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      moveSection(draggedIndex, index);
      setDraggedIndex(index);
    },
    [draggedIndex, moveSection],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave(sections);
    setHasChanges(false);
  }, [sections, onSave]);

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold">Landing Page Builder</h3>
          <p className="text-sm text-gray-500 mt-1">
            Drag sections to reorder, toggle visibility, and customize content
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasChanges
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Save className="h-4 w-4" />
          Save Layout
        </button>
      </div>

      {/* Sections List */}
      <div className="p-4 space-y-2">
        {sections.map((section, index) => {
          const meta = SECTION_LABELS[section.type];
          const isExpanded = expandedId === section.id;

          return (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`rounded-lg border transition-all ${
                draggedIndex === index
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                  : section.visible
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-gray-400">
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Section info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {meta.description}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveSection(index, index - 1)}
                    disabled={index === 0}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveSection(index, index + 1)}
                    disabled={index === sections.length - 1}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleVisibility(section.id)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={section.visible ? "Hide section" : "Show section"}
                  >
                    {section.visible ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : section.id)
                    }
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Section Title
                      </label>
                      <input
                        value={section.title}
                        onChange={(e) => {
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === section.id
                                ? { ...s, title: e.target.value }
                                : s,
                            ),
                          );
                          setHasChanges(true);
                        }}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Type
                      </label>
                      <input
                        value={section.type}
                        readOnly
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview hint */}
      <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400">
          Drag sections to reorder them on your clinic&apos;s landing page
        </p>
      </div>
    </div>
  );
}
