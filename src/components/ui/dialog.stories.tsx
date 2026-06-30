import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "./button";
import {
  Dialog,
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
    <>
      {/* Trigger lives OUTSIDE <Dialog> — the Dialog renders nothing while
          closed, so keeping the trigger here is what lets the dialog be
          reopened after it has been dismissed. */}
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ouvrir le dialogue
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} aria-labelledby="confirm-cancel-title">
          <DialogHeader>
            <DialogTitle id="confirm-cancel-title">Confirmer l&apos;annulation</DialogTitle>
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
      </Dialog>
    </>
  );
}

export const Default: Story = {
  render: () => <DefaultDialogDemo />,
};

function WithFormDialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nouveau patient</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} aria-labelledby="add-patient-title">
          <DialogHeader>
            <DialogTitle id="add-patient-title">Ajouter un patient</DialogTitle>
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
      </Dialog>
    </>
  );
}

export const WithForm: Story = {
  render: () => <WithFormDialogDemo />,
};
