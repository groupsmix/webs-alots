import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

function DefaultDialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <Button variant="outline">Ouvrir le dialogue</Button>
      </DialogTrigger>
      {open && (
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;annulation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler ce rendez-vous ? Le patient sera notifié par
              WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Non, garder
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export const Default: Story = {
  render: () => <DefaultDialogDemo />,
};

function WithFormDialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <Button>Nouveau patient</Button>
      </DialogTrigger>
      {open && (
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Ajouter un patient</DialogTitle>
            <DialogDescription>Remplissez les informations du nouveau patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" placeholder="Fatima Zahra El Amrani" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" placeholder="+212 6XX-XXXXXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance">Assurance</Label>
              <Input id="insurance" placeholder="CNSS" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setOpen(false)}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export const WithForm: Story = {
  render: () => <WithFormDialogDemo />,
};
