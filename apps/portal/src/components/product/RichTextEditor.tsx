'use client';
import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Bold, Italic, Heading2, List, ListOrdered, Link2, Quote, RemoveFormatting } from 'lucide-react';
import { safeHref } from '@oss-commerce/contracts';

/**
 * A small editor for product descriptions: bold, italic, a heading, lists, a quote and links. Nothing else can be made, and whatever is
 * stored is cleaned again by the engine, so what shoppers see is always this safe subset. Loaded only when a product page opens.
 */
export default function RichTextEditor({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (html: string) => void; placeholder?: string }) {
  const [link, setLink] = useState<string | null>(null); const [bad, setBad] = useState(false);
  const editor = useEditor({
    immediatelyRender: false, content: value,
    extensions: [StarterKit.configure({ heading: { levels: [2] }, code: false, codeBlock: false, strike: false, horizontalRule: false, underline: false, link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] } }), Placeholder.configure({ placeholder: placeholder ?? '' })],
    editorProps: { attributes: { id, class: 'rte-body', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Description' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });
  useEffect(() => { if (editor && value !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(value, { emitUpdate: false }); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editor) return <div className="rte"><div className="rte-body" aria-busy /></div>;
  const B = ({ label, on, run, children, disabled }: { label: string; on?: boolean; run: () => void; children: React.ReactNode; disabled?: boolean }) =>
    <button type="button" className="rte-b" aria-label={label} title={label} aria-pressed={on} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={run}>{children}</button>;
  const openLink = () => { setBad(false); setLink(editor.getAttributes('link').href ?? 'https://'); };
  const applyLink = () => {
    const raw = (link ?? '').trim(); if (!raw) { editor.chain().focus().unsetLink().run(); setLink(null); return; }
    const href = safeHref(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); if (!href) { setBad(true); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); setLink(null);
  };
  return (<div className="rte">
    <div className="rte-bar" role="toolbar" aria-label="Formatting">
      <B label="Bold" on={editor.isActive('bold')} run={() => editor.chain().focus().toggleBold().run()}><Bold size={16} aria-hidden /></B>
      <B label="Italic" on={editor.isActive('italic')} run={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} aria-hidden /></B>
      <B label="Heading" on={editor.isActive('heading')} run={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} aria-hidden /></B>
      <B label="Bulleted list" on={editor.isActive('bulletList')} run={() => editor.chain().focus().toggleBulletList().run()}><List size={16} aria-hidden /></B>
      <B label="Numbered list" on={editor.isActive('orderedList')} run={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} aria-hidden /></B>
      <B label="Quote" on={editor.isActive('blockquote')} run={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} aria-hidden /></B>
      <B label="Link" on={editor.isActive('link')} run={openLink}><Link2 size={16} aria-hidden /></B>
      <B label="Clear formatting" run={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><RemoveFormatting size={16} aria-hidden /></B>
    </div>
    {link !== null && <div className="rte-link"><label className="sr" htmlFor={`${id}-url`}>Link address</label><input id={`${id}-url`} autoFocus value={link} inputMode="url" placeholder="https://example.com" onChange={e => { setLink(e.target.value); setBad(false); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { setLink(null); editor.commands.focus(); } }} aria-invalid={bad} />
      <button type="button" className="btn sm primary" onClick={applyLink}>{link.trim() ? 'Add link' : 'Remove link'}</button><button type="button" className="btn sm" onClick={() => { setLink(null); editor.commands.focus(); }}>Cancel</button>
      {bad && <span className="ferr" role="alert">Use a web address (https://) or an email (mailto:).</span>}</div>}
    <EditorContent editor={editor} />
  </div>);
}
