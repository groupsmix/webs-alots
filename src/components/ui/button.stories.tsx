import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Heart, Mail, Loader2, ChevronRight } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
        "success",
        "warning",
      ],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Réserver un rendez-vous" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Annuler" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Modifier" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Supprimer le compte" },
};

export const Success: Story = {
  args: { variant: "success", children: "Confirmer le paiement" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Paiement en attente" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Plus d'options" },
};

export const Link: Story = {
  args: { variant: "link", children: "Voir les conditions" },
};

export const Small: Story = {
  args: { size: "sm", children: "Petit bouton" },
};

export const Large: Story = {
  args: { size: "lg", children: "Grand bouton" },
};

export const WithIcon: Story = {
  args: { children: "Envoyer" },
  render: (args) => (
    <Button {...args}>
      <Mail className="me-2 h-4 w-4" />
      {args.children}
    </Button>
  ),
};

export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Favoris" },
  render: (args) => (
    <Button {...args}>
      <Heart className="h-4 w-4" />
    </Button>
  ),
};

export const Loading: Story = {
  args: { disabled: true, children: "Chargement..." },
  render: (args) => (
    <Button {...args}>
      <Loader2 className="me-2 h-4 w-4 animate-spin" />
      {args.children}
    </Button>
  ),
};

export const WithTrailingIcon: Story = {
  args: { children: "Suivant" },
  render: (args) => (
    <Button {...args}>
      {args.children}
      <ChevronRight className="ms-2 h-4 w-4" />
    </Button>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, children: "Indisponible" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
