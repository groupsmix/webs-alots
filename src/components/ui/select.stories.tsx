import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Label } from "./label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

function DefaultSelectDemo() {
  const [value, setValue] = useState("");
  return (
    <div className="w-[250px]">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir un service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="consultation">Consultation générale</SelectItem>
          <SelectItem value="suivi">Suivi chronique</SelectItem>
          <SelectItem value="urgence">Consultation urgente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const Default: Story = {
  render: () => <DefaultSelectDemo />,
};

function InsuranceTypeSelectDemo() {
  const [value, setValue] = useState("");
  return (
    <div className="w-[250px] space-y-2">
      <Label>Type d&apos;assurance</Label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner l'assurance" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cnss">CNSS</SelectItem>
          <SelectItem value="cnops">CNOPS</SelectItem>
          <SelectItem value="amo">AMO</SelectItem>
          <SelectItem value="ramed">RAMED</SelectItem>
          <SelectItem value="none">Sans assurance</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const InsuranceType: Story = {
  render: () => <InsuranceTypeSelectDemo />,
};

function WithPreselectionSelectDemo() {
  const [value, setValue] = useState("doctor");
  return (
    <div className="w-[250px] space-y-2">
      <Label>Rôle utilisateur</Label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir un rôle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="super_admin">Super Admin</SelectItem>
          <SelectItem value="clinic_admin">Admin Clinique</SelectItem>
          <SelectItem value="doctor">Médecin</SelectItem>
          <SelectItem value="receptionist">Réceptionniste</SelectItem>
          <SelectItem value="patient">Patient</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const WithPreselection: Story = {
  render: () => <WithPreselectionSelectDemo />,
};
