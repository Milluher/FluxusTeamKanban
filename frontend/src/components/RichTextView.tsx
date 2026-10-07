'use client';
import { useEffect, useMemo, useRef } from 'react';
import { sanitizeRichText } from '@/lib/sanitizeRichText';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

// Read-only view of rich-text content produced by RichTextEditor.
//
// The HTML is sanitised before it reaches the DOM. Descriptions are stored as
// markup and the API accepts any string for one, so without this a single
// ticket could run script in the browser of everyone who opened it. It is done
// here, at the one place stored markup becomes DOM, rather than only on write:
// filtering on write would leave anything already stored untouched.
//
// Links are styled by `.rich-editor-content a` in globals.css. Anchors saved
// before the editor set link attributes would navigate the whole app away when
// clicked, so every link is normalised here at render time to open in a new tab
// (with rel guarding against reverse-tabnabbing).
export default function RichTextView({ html, className = '', style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => sanitizeRichText(html), [html]);

  useEffect(() => {
    const anchors = ref.current?.querySelectorAll('a');
    anchors?.forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }, [safeHtml]);

  return (
    <div
      ref={ref}
      className={`rich-editor-content ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
