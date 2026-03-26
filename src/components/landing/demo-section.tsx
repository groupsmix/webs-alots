import { ExternalLink, Lock } from "lucide-react";

export function DemoSection() {
  return (
    <section id="demo" className="bg-gray-50/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600">
            Exemple en direct
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-[2.5rem] sm:leading-[1.15]">
            Voyez le r&eacute;sultat
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-gray-500">
            D&eacute;couvrez &agrave; quoi ressemble un site de cabinet
            cr&eacute;&eacute; avec Oltigo.
          </p>
        </div>

        <div className="mt-14 flex justify-center">
          <a
            href="https://dr-ahmed.oltigo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full max-w-3xl"
          >
            <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-gray-950/[0.05] transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-gray-950/[0.08]">
              {/* Browser chrome */}
              <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-3.5">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                </div>
                <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200/60 bg-white px-4 py-1.5 text-[13px] text-gray-400">
                  <Lock className="h-3 w-3 text-gray-300" />
                  <span className="font-medium text-gray-500">
                    dr-ahmed.oltigo.com
                  </span>
                </div>
                <div className="w-[52px]" />
              </div>

              {/* Site preview */}
              <div className="relative bg-white px-10 py-14 text-center sm:px-16 sm:py-20">
                {/* Subtle background */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-50/30 to-transparent" />

                <div className="relative">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-gray-100">
                    <span className="text-lg font-bold text-blue-600">Dr</span>
                  </div>
                  <div className="mx-auto mb-2 h-5 w-48 rounded-full bg-gray-100" />
                  <div className="mx-auto mb-1.5 h-4 w-64 rounded-full bg-gray-50" />
                  <div className="mx-auto mb-10 h-4 w-40 rounded-full bg-gray-50" />
                  <div className="mx-auto grid max-w-md grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                      >
                        <div className="mx-auto mb-3 h-3 w-3 rounded-full bg-gray-100" />
                        <div className="mx-auto mb-2 h-3 w-full rounded bg-gray-100" />
                        <div className="mx-auto h-2 w-3/4 rounded bg-gray-50" />
                      </div>
                    ))}
                  </div>

                  <p className="mt-10 inline-flex items-center gap-2 text-[14px] font-semibold text-blue-600 transition-colors duration-200 group-hover:text-blue-700">
                    Voir le site en direct
                    <ExternalLink className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </p>
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
