"use client";
import React, { useRef, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────
   PROPS
   ───────────────────────────────────────────── */
export interface LetterPreviewProps {
  variant: number;
  title: string;
  content: string;           // HTML string (already substituted)
  templateId: string;
  accentColor?: string;
  employee?: {
    name: string;
    designation?: string;
    department?: string;
    office?: string;
    company?: string;
    companyDetails?: any;
    date?: string;
  } | null;
  signatory?: {
    name: string;
    designation: string;
    signature_url?: string;
  } | null;
  onContentChange?: (html: string) => void;
  editable?: boolean;
}

/* ─────────────────────────────────────────────
   SHARED BODY RENDERER (no cursor jump)
   ───────────────────────────────────────────── */
const EditableBody: React.FC<{
  content: string;
  editable: boolean;
  onContentChange?: (html: string) => void;
  style?: React.CSSProperties;
}> = ({ content, editable, onContentChange, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isTyping = useRef(false);
  const lastContentRef = useRef(content);

  // Set initial HTML only once on mount, and when content changes externally
  useEffect(() => {
    if (ref.current && content !== lastContentRef.current && !isTyping.current) {
      // Save and restore cursor position
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const cursorOffset = range ? _getCursorOffset(ref.current, range) : -1;

      ref.current.innerHTML = content;
      lastContentRef.current = content;

      // Restore cursor if possible
      if (cursorOffset >= 0) {
        _setCursorOffset(ref.current, cursorOffset);
      }
    } else if (ref.current && !ref.current.innerHTML && content) {
      // Initial mount
      ref.current.innerHTML = content;
      lastContentRef.current = content;
    }
  }, [content]);

  const handleInput = useCallback(() => {
    if (ref.current && onContentChange) {
      isTyping.current = true;
      lastContentRef.current = ref.current.innerHTML;
      onContentChange(ref.current.innerHTML);
      // Reset typing flag after a short delay (after React re-render)
      setTimeout(() => { isTyping.current = false; }, 0);
    }
  }, [onContentChange]);

  // Clear typing flag on blur
  const handleBlur = useCallback(() => {
    isTyping.current = false;
  }, []);

  const executeCommand = (command: string) => {
    document.execCommand(command, false, undefined);
    if (ref.current && onContentChange) {
      isTyping.current = true;
      lastContentRef.current = ref.current.innerHTML;
      onContentChange(ref.current.innerHTML);
      setTimeout(() => { isTyping.current = false; }, 0);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {editable && (
        <div style={{
          background: '#0f172a',
          padding: '4px 6px',
          borderRadius: '6px',
          display: 'inline-flex',
          gap: '6px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          marginBottom: '10px',
          zIndex: 10
        }}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        >
          <button type="button" onClick={() => executeCommand('bold')} style={{ color: '#fff', fontSize: 12, padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: 'none' }}>B</button>
          <button type="button" onClick={() => executeCommand('italic')} style={{ color: '#fff', fontSize: 12, padding: '2px 8px', cursor: 'pointer', fontStyle: 'italic', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: 'none' }}>I</button>
          <button type="button" onClick={() => executeCommand('underline')} style={{ color: '#fff', fontSize: 12, padding: '2px 8px', cursor: 'pointer', textDecoration: 'underline', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: 'none' }}>U</button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        style={{
          fontSize: 12,
          lineHeight: 1.9,
          outline: editable ? '1px dashed rgba(217,249,157,0.4)' : 'none',
          outlineOffset: 4,
          borderRadius: 4,
          minHeight: 60,
          ...style,
        }}
      />
    </div>
  );
};

// ── Cursor position helpers ──
function _getCursorOffset(container: HTMLElement, range: Range): number {
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function _setCursorOffset(container: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let charCount = 0;
  let found = false;

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (charCount + len >= offset) {
        range.setStart(node, offset - charCount);
        range.collapse(true);
        found = true;
        return true;
      }
      charCount += len;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
    }
    return false;
  };

  walk(container);
  if (found) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/* ─────────────────────────────────────────────
   HELPER: accent colour per type
   ───────────────────────────────────────────── */
const typeAccent: Record<string, string> = {
  offer: '#000000',
  appointment: '#2563eb',
  promotion: '#7c3aed',
  transfer: '#d97706',
  resignation: '#dc2626',
  experience: '#0891b2',
  relieving: '#059669',
  warning: '#e11d48',
  form16: '#0284c7',
};

/* ================================================================
   VARIANT 1 – Standard Corporate
   (navy top bar, two-col header, serif body)
   ================================================================ */
const Variant1Layout: React.FC<LetterPreviewProps> = ({
  title, content, templateId, accentColor, employee, signatory, onContentChange, editable = true,
}) => {
  const isBw = accentColor === '#000000' || accentColor === '#000';
  const primaryColor = isBw ? '#000000' : '#0f172a';
  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", color: '#1e293b', width: 794, minHeight: 1123, padding: 0, background: '#fff', position: 'relative', boxSizing: 'border-box' }}>
      <div style={{ background: primaryColor, height: 14, width: '100%' }} />
      <div style={{ padding: '40px 60px 60px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${primaryColor}`, paddingBottom: 20, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/company_logopng.png" alt="Logo" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase', color: primaryColor }}>{employee?.company || 'APAAR LOGISTICS'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#475569', lineHeight: 1.8 }}>
            <div>Date: {employee?.date || '[Date]'}</div>
            <div>Page: {isBw ? '1 of 2' : '1 of 1'}</div>
          </div>
        </div>
        {/* Letter title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', color: accentColor, textDecoration: 'underline', textUnderlineOffset: 4 }}>{title}</span>
        </div>
        {/* Recipient */}
        <div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 20 }}>
          <div><strong>To,</strong></div>
          <div>{employee?.name || '[Employee_Name]'}</div>
          <div>{employee?.designation || '[Designation]'}, {employee?.department || '[Department]'}</div>
          <div>{employee?.company || 'Company'} – {employee?.office || '[Office_Location]'}</div>
        </div>
        {/* Body */}
        <EditableBody content={content} editable={editable} onContentChange={onContentChange} />
        {/* Signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60, paddingTop: 40, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center' }}>
            {signatory?.signature_url ? (
              <img src={signatory.signature_url} alt="Signature" style={{ maxHeight: 40, marginBottom: 4, display: 'block', margin: '0 auto' }} />
            ) : (
              <div style={{ width: 120, borderTop: `2px solid ${primaryColor}`, marginBottom: 6, margin: '0 auto' }} />
            )}
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{signatory ? signatory.name : 'Authorised Signatory'}</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>{signatory?.designation || ''}</div>
          </div>
          <div style={{ textAlign: 'center', opacity: 0.3 }}>
            <div style={{ width: 120, borderTop: `2px solid ${primaryColor}`, marginBottom: 6 }} />
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Employee Signature</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>{employee?.name || '[Employee_Name]'}</div>
          </div>
        </div>
        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 20, left: 60, right: 60, fontSize: 8, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          {employee?.company || 'Apaar Logistics'} Pvt. Ltd. | {employee?.companyDetails?.city || 'Indore Hub'}, {employee?.companyDetails?.state || 'MP'} | {employee?.companyDetails?.email || 'hr@apaarlogistics.com'} | {employee?.companyDetails?.phone || '+91-XXXXX XXXXX'}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   VARIANT 2 – Modern Minimalist
   ================================================================ */
const Variant2Layout: React.FC<LetterPreviewProps> = ({
  title, content, templateId, accentColor, employee, signatory, onContentChange, editable = true,
}) => (
  <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: '#334155', width: 794, minHeight: 1123, background: '#FAFAFA', boxSizing: 'border-box', position: 'relative' }}>
    <div style={{ height: 6, background: accentColor, width: '100%' }} />
    <div style={{ padding: '48px 64px 80px' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 32, marginBottom: 36 }}>
        <img src="/company_logopng.png" alt="Logo" style={{ height: 48, width: 'auto', margin: '0 auto 12px', display: 'block', objectFit: 'contain' }} />
        <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: '8px', textTransform: 'uppercase', color: '#1e293b' }}>{employee?.company?.split(' ')[0] || 'APAAR'}</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: '#94a3b8', marginTop: 4 }}>LOGISTICS · HUMAN RESOURCES</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, fontSize: 9, color: '#64748b', fontWeight: 600 }}>
          <span>Date: {employee?.date || '[Date]'}</span>
        </div>
      </div>
      <div style={{ display: 'inline-block', background: '#f1f5f9', borderRadius: 4, padding: '4px 14px', fontSize: 10, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: accentColor, marginBottom: 24 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 24, color: '#475569' }}>
        <div>To,</div>
        <div style={{ fontWeight: 700, color: '#1e293b' }}>{employee?.name || '[Employee_Name]'}</div>
        <div>{employee?.designation || '[Designation]'} · {employee?.department || '[Department]'}</div>
        <div>{employee?.company || 'Company'}, {employee?.office || '[Office_Location]'}</div>
      </div>
      <EditableBody content={content} editable={editable} onContentChange={onContentChange} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 56 }}>
        <div>
          {signatory?.signature_url ? (
            <img src={signatory.signature_url} alt="Signature" style={{ maxHeight: 40, marginBottom: 4, display: 'block' }} />
          ) : (
            <div style={{ width: 110, borderBottom: '1px solid #1e293b', marginBottom: 6 }} />
          )}
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#1e293b' }}>{signatory ? signatory.name : 'Authorised Signatory'}</div>
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{signatory ? signatory.designation : `For ${employee?.company || 'Company'}`}</div>
        </div>
        <div style={{ opacity: 0.25 }}>
          <div style={{ width: 110, borderBottom: '1px solid #1e293b', marginBottom: 6 }} />
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Employee Signature</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 24, left: 64, right: 64, textAlign: 'center', fontSize: 8, color: '#cbd5e1' }}>
        {employee?.company?.toUpperCase() || 'APAAR LOGISTICS'} PVT. LTD. · {employee?.companyDetails?.city?.toUpperCase() || 'INDORE HUB'} · {employee?.companyDetails?.email?.toUpperCase() || 'HR@APAARLOGISTICS.COM'}
      </div>
    </div>
  </div>
);

/* ================================================================
   VARIANT 3 – Premium Executive
   ================================================================ */
const Variant3Layout: React.FC<LetterPreviewProps> = ({
  title, content, templateId, accentColor, employee, signatory, onContentChange, editable = true,
}) => {
  const isBw = accentColor === '#000000' || accentColor === '#000';
  const primaryColor = isBw ? '#000000' : '#0f172a';
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: '#1e293b', width: 794, minHeight: 1123, background: '#fff', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ background: primaryColor, padding: '40px 60px 36px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/company_logopng.png" alt="Logo" style={{ height: 42, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', textTransform: 'uppercase' }}>{employee?.company || 'APAAR LOGISTICS'}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: '4px', textTransform: 'uppercase', marginTop: 6 }}>Human Resources · Premium Division</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>
            <div>Date: {employee?.date || '[Date]'}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -14, left: 60, background: accentColor, color: '#fff', padding: '4px 20px', fontSize: 10, fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase', borderRadius: 2 }}>
          {title}
        </div>
      </div>
      <div style={{ padding: '60px 60px 80px' }}>
        <div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 24 }}>
          <div><strong>To,</strong></div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{employee?.name || '[Employee_Name]'}</div>
          <div>{employee?.designation || '[Designation]'} — {employee?.department || '[Department]'}</div>
          <div>{employee?.company || 'Company'}, {employee?.office || '[Office_Location]'}</div>
        </div>
        <EditableBody content={content} editable={editable} onContentChange={onContentChange} />
        <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {signatory?.signature_url ? (
              <img src={signatory.signature_url} alt="Signature" style={{ maxHeight: 40, marginBottom: 4, display: 'block' }} />
            ) : (
              <div style={{ width: 130, borderTop: `2px solid ${primaryColor}`, marginBottom: 8 }} />
            )}
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{signatory ? signatory.name : 'Authorised Signatory'}</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{signatory ? signatory.designation : `For ${employee?.company || 'Company'}`}</div>
          </div>
          <div style={{ opacity: 0.3 }}>
            <div style={{ width: 130, borderTop: `2px solid ${primaryColor}`, marginBottom: 8 }} />
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Employee Signature</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 20, left: 60, right: 60, fontSize: 8, color: '#64748b', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          {employee?.company?.toUpperCase() || 'APAAR LOGISTICS'} PVT. LTD. · {employee?.companyDetails?.email?.toUpperCase() || 'HR@APAARLOGISTICS.COM'}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   VARIANT 4 – Creative Edge
   ================================================================ */
const Variant4Layout: React.FC<LetterPreviewProps> = ({
  title, content, templateId, accentColor, employee, signatory, onContentChange, editable = true,
}) => {
  const isBw = accentColor === '#000000' || accentColor === '#000';
  const primaryColor = isBw ? '#000000' : '#0f172a';
  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: '#1e293b', width: 794, minHeight: 1123, background: '#fff', boxSizing: 'border-box', position: 'relative', display: 'flex' }}>
      <div style={{ width: 8, background: accentColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '48px 56px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ fontSize: 60, fontWeight: 900, color: accentColor, lineHeight: 1, opacity: 0.15, position: 'absolute', top: 20, left: 80 }}>{title.charAt(0)}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px', color: '#0f172a', position: 'relative', zIndex: 1 }}>{title}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: '3px', textTransform: 'uppercase', marginTop: 2 }}>{employee?.company || 'Company'}</div>
            </div>
          </div>
          <img src="/company_logopng.png" alt="Logo" style={{ height: 38, width: 'auto', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 32, fontSize: 9, color: '#64748b', fontWeight: 600, marginBottom: 32, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
          <span>Date: {employee?.date || '[Date]'}</span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{employee?.name || '[Employee_Name]'}</div>
          <div>{employee?.designation || '[Designation]'} · {employee?.department || '[Department]'}</div>
          <div>{employee?.company || 'Company'}, {employee?.office || '[Office_Location]'}</div>
        </div>
        <EditableBody content={content} editable={editable} onContentChange={onContentChange} />
        <div style={{ marginTop: 56, display: 'flex', gap: 60 }}>
          <div>
            {signatory?.signature_url ? (
              <img src={signatory.signature_url} alt="Signature" style={{ maxHeight: 40, marginBottom: 4, display: 'block' }} />
            ) : (
              <div style={{ width: 120, borderBottom: `2px solid ${primaryColor}`, marginBottom: 6 }} />
            )}
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{signatory ? signatory.name : 'Authorised Signatory'}</div>
            {signatory && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{signatory.designation}</div>}
          </div>
          <div style={{ opacity: 0.25 }}>
            <div style={{ width: 120, borderBottom: `2px solid ${primaryColor}`, marginBottom: 6 }} />
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Employee Signature</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 20, left: 80, right: 56, fontSize: 8, color: '#cbd5e1', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          {employee?.company?.toUpperCase() || 'APAAR LOGISTICS'} · {employee?.companyDetails?.email?.toUpperCase() || 'HR@APAARLOGISTICS.COM'}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   VARIANT 5 – Classic Formal
   ================================================================ */
const Variant5Layout: React.FC<LetterPreviewProps> = ({
  title, content, templateId, accentColor, employee, signatory, onContentChange, editable = true,
}) => {
  const isBw = accentColor === '#000000' || accentColor === '#000';
  const primaryColor = isBw ? '#000000' : '#0f172a';
  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: '#1e293b', width: 794, minHeight: 1123, background: '#fff', boxSizing: 'border-box', position: 'relative', padding: 16 }}>
      <div style={{ border: `3px double ${primaryColor}`, padding: '40px 52px 70px', minHeight: 'calc(100% - 32px)', position: 'relative', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', borderBottom: `1px solid ${primaryColor}`, paddingBottom: 24, marginBottom: 32 }}>
          <img src="/company_logopng.png" alt="Logo" style={{ height: 42, width: 'auto', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '5px', textTransform: 'uppercase', color: '#64748b' }}>{employee?.company || 'APAAR LOGISTICS'}</div>
          <div style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', color: primaryColor, marginTop: 12 }}>{title}</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 6 }}>Date: {employee?.date || '[Date]'}</div>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 24 }}>
          <div><strong>To,</strong></div>
          <div style={{ fontWeight: 700 }}>{employee?.name || '[Employee_Name]'}</div>
          <div>{employee?.designation || '[Designation]'}, {employee?.department || '[Department]'}</div>
          <div>{employee?.company || 'Company'} — {employee?.office || '[Office_Location]'}</div>
        </div>
        <EditableBody content={content} editable={editable} onContentChange={onContentChange} />
        <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center' }}>
            {signatory?.signature_url ? (
              <img src={signatory.signature_url} alt="Signature" style={{ maxHeight: 40, marginBottom: 4, display: 'block', margin: '0 auto' }} />
            ) : (
              <div style={{ width: 130, borderTop: `1px solid ${primaryColor}`, marginBottom: 6, margin: '0 auto' }} />
            )}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{signatory ? signatory.name : 'Authorised Signatory'}</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>{signatory ? signatory.designation : `For ${employee?.company || 'Company'}`}</div>
          </div>
          <div style={{ textAlign: 'center', opacity: 0.3 }}>
            <div style={{ width: 130, borderTop: `2px solid ${primaryColor}`, marginBottom: 6 }} />
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Employee Signature</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 30, left: 52, right: 52, textAlign: 'center', fontSize: 8, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          {employee?.company?.toUpperCase() || 'APAAR LOGISTICS'} PVT. LTD. · {employee?.companyDetails?.email?.toUpperCase() || 'HR@APAARLOGISTICS.COM'}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   UNIFIED EXPORT
   ================================================================ */
export const LetterPreview: React.FC<LetterPreviewProps> = (props) => {
  const { variant } = props;
  switch (variant) {
    case 1: return <Variant1Layout {...props} />;
    case 2: return <Variant2Layout {...props} />;
    case 3: return <Variant3Layout {...props} />;
    case 4: return <Variant4Layout {...props} />;
    case 5: return <Variant5Layout {...props} />;
    default: return <Variant1Layout {...props} />;
  }
};

// Backward-compatible exports
export const Variant1 = Variant1Layout;
export const Variant2 = Variant2Layout;
export const Variant3 = Variant3Layout;
export const Variant4 = Variant4Layout;
export const Variant5 = Variant5Layout;

export const typeAccentMap = typeAccent;
