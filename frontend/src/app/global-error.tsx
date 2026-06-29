'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}>
          <h2 style={{ marginBottom: '1rem' }}>Something went wrong!</h2>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: '#f4f4f4',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
