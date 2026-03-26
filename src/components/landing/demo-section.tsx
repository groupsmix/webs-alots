import { ExternalLink, Lock } from "lucide-react";

export function DemoSection() {
  return (
    <section id="demo" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Exemple en direct
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Voyez le r&eacute;sultat
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            D&eacute;couvrez &agrave; quoi ressemble un site de cabinet cr&eacute;&eacute; avec Oltigo.
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="https://dr-ahmed.oltigo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full max-w-2xl"
          >
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-lg transition-all group-hover:border-gray-300 group-hover:shadow-xl">
              {/* Browser chrome mockup */}
              <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-300" />
                  <div className="h-3 w-3 rounded-full bg-yellow-300" />
                  <div className="h-3 w-3 rounded-full bg-green-300" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-1.5 text-sm text-gray-500">
                  <Lock className="h-3 w-3 text-green-500" />
                  <span>dr-ahmed.oltigo.com</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>

              {/* Placeholder site content */}
              <div className="bg-gradient-to-b from-blue-50/50 to-white px-8 py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <span className="text-lg font-bold text-blue-600">Dr</span>
                </div>
                <div className="mx-auto mb-2 h-5 w-52 rounded-full bg-gray-200" />
                <div className="mx-auto mb-8 h-4 w-72 rounded-full bg-gray-100" />
                <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                  <div className="h-20 rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
                  <div className="h-20 rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
                  <div className="h-20 rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
                </div>
                <p className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors group-hover:text-blue-700">
                  Voir le site en direct
                  <ExternalLink className="h-3.5 w-3.5" />
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
