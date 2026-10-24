import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">CYBER AI / 404</span>
      <h1>This route is outside the map.</h1>
      <p>The requested lesson or workflow could not be found.</p>
      <Link className="button primary" href="/dashboard">
        Return to command center
      </Link>
    </main>
  );
}
