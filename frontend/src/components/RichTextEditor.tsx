'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { useEffect, useRef } from 'react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const ToolbarBtn = ({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className="flex items-center justify-center w-7 h-7 rounded-md text-xs font-semibold transition-all duration-100 flex-shrink-0"
    style={{
      background: active ? '#fff7f5' : 'transparent',
      color: active ? '#e8390e' : '#6b7280',
      border: active ? '1px solid #fbd5c8' : '1px solid transparent',
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = '#f9fafb';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
);

export default function RichTextEditor({ content, onChange, placeholder = 'Add a description...', minHeight = 120 }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        style: `min-height:${minHeight}px; padding: 10px 12px;`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external content changes (e.g. when modal resets)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) return null;

  const inTable = editor.isActive('table');
  const headingLevel = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
    ? '2'
    : editor.isActive('heading', { level: 3 })
    ? '3'
    : '';

  const setHeading = (level: string) => {
    if (!level) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: parseInt(level) as 1 | 2 | 3 }).run();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-150"
      style={{ border: '1px solid #e5e7eb' }}
      onFocus={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#e8390e';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}
      >
        {/* Bold */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </ToolbarBtn>

        {/* Italic */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </ToolbarBtn>

        <Divider />

        {/* Font size / heading */}
        <select
          value={headingLevel}
          onChange={(e) => setHeading(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          title="Text size"
          className="text-xs font-medium rounded-md px-1.5 py-1 outline-none transition-all duration-100 flex-shrink-0"
          style={{
            border: headingLevel ? '1px solid #fbd5c8' : '1px solid #e5e7eb',
            background: headingLevel ? '#fff7f5' : 'white',
            color: headingLevel ? '#e8390e' : '#6b7280',
            height: '28px',
          }}
        >
          <option value="">Normal</option>
          <option value="3">Large</option>
          <option value="2">Heading</option>
          <option value="1">Title</option>
        </select>

        <Divider />

        {/* Bullet list */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6"/>
            <line x1="9" y1="12" x2="20" y2="12"/>
            <line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </ToolbarBtn>

        {/* Ordered list */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"/>
            <line x1="10" y1="12" x2="21" y2="12"/>
            <line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M4 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </ToolbarBtn>

        {/* Checklist */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Checklist"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="4" height="4" rx="0.5"/>
            <polyline points="4 7 5 8.5 7 6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="10" y1="7" x2="21" y2="7"/>
            <rect x="3" y="13" width="4" height="4" rx="0.5"/>
            <line x1="10" y1="15" x2="21" y2="15"/>
          </svg>
        </ToolbarBtn>

        <Divider />

        {/* Insert image */}
        <ToolbarBtn
          onClick={() => imageInputRef.current?.click()}
          title="Insert image"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </ToolbarBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Insert table */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          active={inTable}
          title="Insert table"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </ToolbarBtn>

        {/* Table controls — shown only when cursor is inside a table */}
        {inTable && (
          <>
            <ToolbarBtn
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="Add column after"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="9" height="18" rx="1"/>
                <line x1="16" y1="8" x2="16" y2="16"/>
                <line x1="12" y1="12" x2="20" y2="12"/>
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="Add row below"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="9" rx="1"/>
                <line x1="8" y1="16" x2="16" y2="16"/>
                <line x1="12" y1="12" x2="12" y2="20"/>
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="Delete column"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="9" height="18" rx="1"/>
                <line x1="14" y1="10" x2="20" y2="16"/>
                <line x1="20" y1="10" x2="14" y2="16"/>
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="Delete row"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="9" rx="1"/>
                <line x1="10" y1="16" x2="16" y2="22"/>
                <line x1="16" y1="16" x2="10" y2="22"/>
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="Delete table"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
              </svg>
            </ToolbarBtn>
          </>
        )}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
