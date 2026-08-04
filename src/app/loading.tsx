export default function Loading() {
  return (
    <div
      className="bg-background flex min-h-screen items-center justify-center"
      role="status"
    >
      <div className="border-muted border-t-foreground size-10 animate-spin rounded-full border-2 motion-reduce:animate-none" />
      <span className="sr-only">Chargement de VestyHub…</span>
    </div>
  );
}
