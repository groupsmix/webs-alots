export interface BuilderTemplate {
  id: string
  name: string
  description: string
  icon: string
  language: string
  runtime: 'nextjs' | 'python' | 'vanilla'
  defaultPrompt: string
  sandboxTimeoutMs: number
}

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: 'nextjs-report',
    name: 'Clinic Report',
    description: 'Generate a custom analytics report for a clinic with charts',
    icon: '📊',
    language: 'TypeScript',
    runtime: 'nextjs',
    defaultPrompt: 'Create a Next.js page that shows a clinic analytics report with appointment volume chart, patient demographics pie chart, and revenue by month bar chart. Use recharts. Use mock data shaped like: { appointments: number, patients: number, revenue: number }[]',
    sandboxTimeoutMs: 120_000,
  },
  {
    id: 'python-migration',
    name: 'DB Migration Script',
    description: 'Generate a PostgreSQL migration script',
    icon: '🗄️',
    language: 'Python',
    runtime: 'python',
    defaultPrompt: 'Write a Python script that generates a Supabase migration SQL file. The script should output valid PostgreSQL ALTER TABLE statements.',
    sandboxTimeoutMs: 60_000,
  },
  {
    id: 'nextjs-form',
    name: 'Admin Form',
    description: 'Generate a custom admin form or data entry page',
    icon: '📝',
    language: 'TypeScript',
    runtime: 'nextjs',
    defaultPrompt: 'Create a Next.js form component using shadcn/ui and react-hook-form with zod validation.',
    sandboxTimeoutMs: 120_000,
  },
  {
    id: 'python-analysis',
    name: 'Data Analysis',
    description: 'Analyze CSV or JSON data with Python',
    icon: '🔬',
    language: 'Python',
    runtime: 'python',
    defaultPrompt: 'Write a Python script that analyzes data and outputs a summary with statistics.',
    sandboxTimeoutMs: 90_000,
  },
]

export const DEFAULT_TEMPLATE = BUILDER_TEMPLATES[0]
