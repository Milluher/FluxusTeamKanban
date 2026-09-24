'use client';
import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

// Read-only view of rich-text content produced by RichTextEditor.
//
// Links are styled by `.rich-editor-content a` in globals.css. Anchors saved
// before the editor set link attributes would navigate the whole app away when
// clicked, so every link is normalised here at render time to open in a new tab
// (with rel guarding against reverse-tabnabbing).
export default function RichTextView({ html, className = '', style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchors = ref.current?.querySelectorAll('a');
    anchors?.forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={`rich-editor-content ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
