'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const DEFAULT_FIELDS = [
  {
    name: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name',
  },
  {
    name: 'phone',
    label: 'Phone Number',
    type: 'tel',
    required: true,
    placeholder: '+234 800 000 0000',
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    required: false,
    placeholder: 'your@email.com',
  },
];

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [form, setForm] = useState<any>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/forms/s/${slug}`)
      .then(async (r) => {
        // fetch only rejects on network failure — a 404 still resolves, so the
        // status has to be checked explicitly or "Form not found" renders as a
        // blank form.
        if (!r.ok) throw new Error('Form not found');
        return r.json();
      })
      .then((data) => {
        setForm(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Form not found');
        setLoading(false);
      });
  }, [slug]);

  // Report height to the embedding page so embed.js can size the iframe.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const post = () => {
      const height = rootRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent.postMessage({ type: 'meetora-resize', height }, '*');
    };
    post();
    const observer = new ResizeObserver(post);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [form, submitted, error, loading]);

  const fields = form?.fields?.length ? form.fields : DEFAULT_FIELDS;

  async function handleSubmit() {
    const missing = fields
      .filter((f: any) => f.required && !(values[f.name] || '').trim())
      .map((f: any) => f.label);
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/forms/s/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Array.isArray(err.message) ? err.message.join(', ') : err.message,
        );
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          // The public form is a light standalone page; without an explicit
          // background it inherits the dark app theme from <body>.
          background: '#f5f5f5',
        }}
      >
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    );

  if (error && !form)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          // The public form is a light standalone page; without an explicit
          // background it inherits the dark app theme from <body>.
          background: '#f5f5f5',
        }}
      >
        <p style={{ color: '#A32D2D' }}>{error}</p>
      </div>
    );

  if (submitted)
    return (
      <div
        ref={rootRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 24,
          textAlign: 'center',
          background: '#f5f5f5',
          color: '#1a1a1a',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Thank you!
        </h2>
        <p style={{ fontSize: 16, color: '#666' }}>
          Your details have been saved successfully.
        </p>
      </div>
    );

  return (
    <div
      ref={rootRef}
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 8,
            color: '#1a1a1a',
          }}
        >
          {form?.title}
        </h1>
        {form?.description && (
          <p
            style={{
              fontSize: 15,
              color: '#666',
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            {form.description}
          </p>
        )}

        {fields.map((field: any) => (
          <div key={field.name} style={{ marginBottom: 16 }}>
            <label
              htmlFor={`field-${field.name}`}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#333',
                display: 'block',
                marginBottom: 6,
              }}
            >
              {field.label}
              {field.required && <span style={{ color: '#e24b4a' }}> *</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`field-${field.name}`}
                value={values[field.name] || ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  border: '1px solid #ddd',
                  resize: 'vertical',
                }}
              />
            ) : field.type === 'select' ? (
              <select
                id={`field-${field.name}`}
                value={values[field.name] || ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  border: '1px solid #ddd',
                  background: '#fff',
                }}
              >
                <option value="">Select…</option>
                {(field.options || []).map((opt: string) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`field-${field.name}`}
                type={field.type}
                value={values[field.name] || ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  border: '1px solid #ddd',
                }}
              />
            )}
          </div>
        ))}

        {error && (
          <p style={{ color: '#A32D2D', fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting ? '#ccc' : '#F97316',
            color: '#fff',
            border: 'none',
            marginTop: 8,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>

        <p
          style={{
            fontSize: 12,
            color: '#999',
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          Powered by Meetora
        </p>
      </div>
    </div>
  );
}
