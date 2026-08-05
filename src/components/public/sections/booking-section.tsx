import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/80 transition-colors min-h-11";

interface BookingSectionProps {
  locale?: Locale;
}

export function BookingSection({ locale = "fr" }: BookingSectionProps) {
  return (
    <section className="py-16 sm:py-24 bg-primary/5">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance mb-4 text-foreground">
          {t(locale, "public.sections.booking-section.pretAReserver")}
        </h2>
        <p className="mb-8 sm:mb-10 max-w-xl mx-auto text-muted-foreground">
          {t(locale, "public.sections.booking-section.prenezRendezvousEnLigne")}
        </p>
        <Link
          href="/book"
          data-event="cta-booking-section"
          className={`${linkBtnPrimary} w-full sm:w-auto`}
        >
          {t(locale, "public.bookAppointment")}
        </Link>
      </div>
    </section>
  );
}
