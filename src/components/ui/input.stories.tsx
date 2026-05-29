import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "tel", "number", "search", "date"],
    },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Nom du patient..." },
};

export const Email: Story = {
  args: { type: "email", placeholder: "patient@example.com" },
};

export const Password: Story = {
  args: { type: "password", placeholder: "Mot de passe" },
};

export const Phone: Story = {
  args: { type: "tel", placeholder: "+212 6XX-XXXXXX" },
};

export const Search: Story = {
  args: { type: "search", placeholder: "Rechercher un patient..." },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Champ désactivé", value: "Non modifiable" },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="patient-name">Nom complet</Label>
      <Input id="patient-name" placeholder="Fatima Zahra El Amrani" />
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="phone">Téléphone</Label>
      <Input id="phone" aria-invalid="true" className="border-destructive" defaultValue="+212" />
      <p className="text-sm text-destructive">Numéro de téléphone invalide</p>
    </div>
  ),
};
