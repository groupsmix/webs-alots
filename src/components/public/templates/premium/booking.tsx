import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PremiumBookingProps {
  locale?: Locale;
}

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/80 transition-colors min-h-11";

export function PremiumBooking({ locale = "fr" }: PremiumBookingProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary to-secondary text-primary-foreground py-16 sm:py-24">
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance mb-4 text-white">
          {t(locale, "public.sections.booking-section.pretAReserver")}
        </h2>
        <p className="mb-8 sm:mb-10 max-w-xl mx-auto text-primary-foreground/80">
          {t(locale, "public.sections.booking-section.prenezRendezvousEnLigne")}
        </p>
        <Link
          href="/book"
          data-event="cta-booking-section"
          className={cn(linkBtnPrimary, "w-full sm:w-auto bg-white text-primary hover:bg-white/90")}
        >
          {t(locale, "public.bookAppointment")}
        </Link>
      </div>
    </section>
  );
}
