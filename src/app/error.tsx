"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>We couldn’t load the studio</h1>
      <p>Check your database connection and try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
