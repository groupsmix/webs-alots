"use client";

import {
  ExternalLink,
  Share2,
  LayoutDashboard,
  CalendarPlus,
  QrCode,
  MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Confetti } from "./confetti";

interface CelebrationPageProps {
  clinicName: string;
  subdomain: string;
  ownerName: string;
  phone: string;
}

export function CelebrationPage({
  clinicName,
  subdomain,
  ownerName,
  phone,
}: CelebrationPageProps) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const clinicUrl = `https://${subdomain}.oltigo.com`;
  const whatsappMessage = encodeURIComponent(
    `Découvrez mon nouveau site professionnel : ${clinicUrl}`,
  );
  const whatsappShareUrl = `https://wa.me/?text=${whatsappMessage}`;

  useEffect(() => {
    QRCode.toDataURL(clinicUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#1E4DA1", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => {
        /* QR generation failed — non-critical */
      });
  }, [clinicUrl]);

  return (
    <>
      <Confetti duration={5000} />

      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Votre site est en ligne !
          </h1>
          <p className="text-muted-foreground text-lg">
            F&eacute;licitations <strong>{ownerName}</strong>,{" "}
            <strong>{clinicName}</strong> est pr&ecirc;t &agrave; recevoir des
            rendez-vous.
          </p>
        </div>

        {/* Live URL Card */}
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Votre site est accessible &agrave;
            </p>
            <a
              href={clinicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-bold text-primary font-mono flex items-center justify-center gap-2 hover:underline"
            >
              {subdomain}.oltigo.com
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Aper&ccedil;u de votre site
            </p>
            <div className="rounded-lg border overflow-hidden bg-white">
              <iframe
                src={clinicUrl}
                title={`Aperçu de ${clinicName}`}
                className="w-full h-[400px] border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>

        {/* QR Code + Share */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* QR Code */}
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm font-medium flex items-center justify-center gap-2">
                <QrCode className="h-4 w-4" />
                QR Code de votre site
              </p>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code pour ${clinicUrl}`}
                  className="mx-auto rounded-lg"
                  width={160}
                  height={160}
                />
              ) : (
                <div className="h-40 w-40 mx-auto bg-muted rounded-lg animate-pulse" />
              )}
              <p className="text-xs text-muted-foreground">
                Scannez pour visiter votre site
              </p>
            </CardContent>
          </Card>

          {/* Share Actions */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Partagez votre site
              </p>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    Partager sur WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Envoyez le lien &agrave; vos contacts
                  </p>
                </div>
              </a>

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors w-full text-left"
                onClick={() => {
                  void navigator.clipboard.writeText(clinicUrl);
                }}
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Copier le lien</p>
                  <p className="text-xs text-muted-foreground">
                    {subdomain}.oltigo.com
                  </p>
                </div>
              </button>

              {phone && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Un message WhatsApp de bienvenue a &eacute;t&eacute;
                  envoy&eacute; au {phone}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            className="w-full"
            onClick={() => router.push("/admin/dashboard")}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Acc&eacute;der au tableau de bord
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => router.push("/admin/appointments")}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            R&eacute;server un premier rendez-vous
          </Button>
        </div>

        {/* Getting Started Hint */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Prochaine &eacute;tape :</strong> Personnalisez
              votre site depuis le tableau de bord &mdash; ajoutez votre logo,
              modifiez les services, et invitez votre &eacute;quipe.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
