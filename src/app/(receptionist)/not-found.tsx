import Link from "next/link";

export default function ReceptionistNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous recherchez n&apos;existe pas dans l&apos;espace réception.
        </p>
        <Link
          href="/receptionist/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
