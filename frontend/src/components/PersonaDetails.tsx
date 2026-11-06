'use client';
import { Persona, TechComfort } from '@/types';
import { formatTimestamp } from '@/lib/formatDate';

/**
 * What a persona says about itself — tech comfort, the template's answers, and
 * who added it. Shared by the Personas panel and the PRD's §10 so the two
 * cannot drift into describing the same persona differently.
 */

/** The template, in the order a persona reads best. */
export const PERSONA_ATTRIBUTES: { key: keyof Persona; label: string; rows: number }[] = [
  { key: 'segment', label: 'Segment', rows: 1 },
  { key: 'description', label: 'Description', rows: 3 },
  { key: 'goals', label: 'Goals', rows: 3 },
  { key: 'painPoints', label: 'Pain points', rows: 3 },
  { key: 'behaviours', label: 'Behaviours', rows: 3 },
];

export const TECH_COMFORT: { value: TechComfort; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low tech comfort', color: '#b45309', bg: '#fffbeb' },
  { value: 'medium', label: 'Medium tech comfort', color: '#1d4ed8', bg: '#eff6ff' },
  { value: 'high', label: 'High tech comfort', color: '#047857', bg: '#ecfdf5' },
];

export default function PersonaDetails({ persona }: { persona: Persona }) {
  const comfort = TECH_COMFORT.find((t) => t.value === persona.techComfort);
  const filled = PERSONA_ATTRIBUTES.filter(({ key }) => persona[key]);
  const added = formatTimestamp(persona.createdAt);

  return (
    <div className="space-y-2.5">
      {comfort && (
        <span
          className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: comfort.bg, color: comfort.color }}
        >
          {comfort.label}
        </span>
      )}
      {filled.length === 0 && !comfort ? (
        <p className="text-xs text-gray-500">Nothing recorded yet beyond the name.</p>
      ) : (
        filled.map(({ key, label }) => (
          <div key={key}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{persona[key] as string}</p>
          </div>
        ))
      )}
      {persona.createdBy && (
        <p className="text-xs text-gray-500 pt-0.5">
          Added by {persona.createdBy.name}{added ? ` · ${added}` : ''}
        </p>
      )}
    </div>
  );
}
