import { ExternalLink } from "lucide-react";

export function DemoSection() {
  return (
    <section id="demo" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Voyez le résultat
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Découvrez à quoi ressemble un site de cabinet créé avec Oltigo.
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
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-1.5 text-sm text-gray-500">
                  <span>dr-ahmed.oltigo.com</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>

              {/* Placeholder content */}
              <div className="px-8 py-12 text-center">
                <div className="mx-auto mb-6 h-12 w-12 rounded-xl bg-gray-200" />
                <div className="mx-auto mb-3 h-5 w-48 rounded bg-gray-200" />
                <div className="mx-auto mb-8 h-4 w-64 rounded bg-gray-100" />
                <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                  <div className="h-20 rounded-lg bg-gray-200" />
                  <div className="h-20 rounded-lg bg-gray-200" />
                  <div className="h-20 rounded-lg bg-gray-200" />
                </div>
                <p className="mt-8 text-sm font-medium text-gray-500">
                  Cliquez pour voir le site en direct
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
