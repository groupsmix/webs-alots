"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";

export function MobileCtaBar() {
  const { dict } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ink/95 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Button variant="secondary" size="md" href="#demo" className="flex-1">
          {dict.cta.submit}
        </Button>
        <Button variant="primary" size="md" href="/register-clinic" className="flex-1">
          {dict.hero.ctaPrimary}
        </Button>
      </div>
    </div>
  );
}
