export default function ProfileLoading() {
  return (
    <main className="flex-1 bg-espresso px-5 py-6">
      <div className="w-full max-w-md mx-auto" aria-hidden>
        <div className="flex items-center justify-between min-h-11">
          <div className="h-6 w-24 rounded-md bg-espresso-2 animate-pulse" />
          <div className="h-5 w-16 rounded-md bg-espresso-2 animate-pulse" />
        </div>
        <div className="h-1 w-full mt-3 rounded-full bg-espresso-2 animate-pulse" />
        <div className="h-3 w-32 mt-3 rounded-md bg-espresso-2 animate-pulse" />
        <div className="h-8 w-2/3 mt-8 rounded-md bg-espresso-2 animate-pulse" />
        <div className="h-4 w-full mt-3 rounded-md bg-espresso-2 animate-pulse" />
        <div className="mt-8 space-y-6">
          <div className="h-12 w-full rounded-md bg-espresso-2 animate-pulse" />
          <div className="h-12 w-full rounded-md bg-espresso-2 animate-pulse" />
          <div className="h-12 w-full rounded-md bg-espresso-2 animate-pulse" />
          <div className="h-12 w-full rounded-md bg-espresso-2 animate-pulse" />
        </div>
        <div className="h-12 w-full mt-10 rounded-full bg-espresso-2 animate-pulse" />
      </div>
    </main>
  );
}
