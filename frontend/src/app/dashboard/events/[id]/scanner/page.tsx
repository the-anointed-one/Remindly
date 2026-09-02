'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

function ScannerContent() {
  const params = useParams();
  const eventId = params.id as string;
  const [result, setResult] = useState<{
    success: boolean;
    contactName?: string;
    message?: string;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);
  // The camera callback is created once per scanner render, so it closes over a
  // stale `scanning`. A ref is the guard the callback can actually read —
  // without it html5-qrcode re-submits the same badge ~10x/second.
  const scanningRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function processQrData(rawData: string) {
    if (scanningRef.current) return;
    const trimmed = (rawData ?? '').trim();
    if (!trimmed) return;

    scanningRef.current = true;
    setScanning(true);
    try {
      let token = trimmed;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.token) token = parsed.token;
      } catch {
        /* not JSON — treat the raw text as the token */
      }

      const { data } = await api.post(`/events/${eventId}/scan`, { token });
      setResult({ success: true, ...data });
      setManualInput('');
    } catch (err: any) {
      setResult({
        success: false,
        message:
          err.response?.data?.message || 'Invalid or already used QR code',
      });
    } finally {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        scanningRef.current = false;
        setScanning(false);
        setResult(null);
      }, 3000);
    }
  }

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    let cancelled = false;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: 250 },
        false,
      );
      scanner.render(
        (decodedText: string) => {
          processQrData(decodedText);
        },
        () => {
          /* per-frame decode misses are normal — ignore */
        },
      );
      scannerRef.current = scanner;
    });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [cameraActive]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 24,
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        QR Check-In Scanner
      </h1>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          marginBottom: 24,
        }}
      >
        Scan attendee QR codes to confirm arrival
      </p>

      {/* Result banner */}
      {result && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            textAlign: 'center',
            marginBottom: 24,
            background: result.success ? '#E1F5EE' : '#FCEBEB',
            color: result.success ? '#085041' : '#791F1F',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {result.success ? '✅' : '❌'}
          </div>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {result.success
              ? `Welcome, ${result.contactName}!`
              : 'Check-in failed'}
          </p>
          <p style={{ fontSize: 14 }}>{result.message}</p>
        </div>
      )}

      {/* Camera scanner */}
      {!cameraActive ? (
        <button
          onClick={() => setCameraActive(true)}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            marginBottom: 16,
          }}
        >
          📷 Start Camera Scanner
        </button>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <div
            id="qr-reader"
            style={{
              width: '100%',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          />
          <button
            onClick={() => setCameraActive(false)}
            style={{
              marginTop: 8,
              fontSize: 13,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Stop camera
          </button>
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '16px 0',
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          OR ENTER MANUALLY
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Manual token input */}
      <input
        type="text"
        placeholder="Paste QR token or scan result"
        value={manualInput}
        onChange={(e) => setManualInput(e.target.value)}
        title="Paste the QR token to check in manually"
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 8,
          fontSize: 14,
          border: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          marginBottom: 10,
        }}
      />
      <button
        onClick={() => processQrData(manualInput)}
        disabled={scanning || !manualInput.trim()}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 500,
          cursor: 'pointer',
          background:
            scanning || !manualInput.trim() ? 'var(--border)' : 'var(--primary)',
          color: '#fff',
          border: 'none',
        }}
      >
        {scanning ? 'Processing...' : 'Check In'}
      </button>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          Loading scanner...
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}
