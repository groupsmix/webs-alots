import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Calendar, Search, Users, FileText } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoAppointments: Story = {
  args: {
    icon: Calendar,
    title: "Aucun rendez-vous",
    description: "Vous n'avez pas encore de rendez-vous planifié.",
    action: <Button>Prendre rendez-vous</Button>,
  },
};

export const NoSearchResults: Story = {
  args: {
    icon: Search,
    title: "Aucun résultat",
    description: "Aucun patient ne correspond à votre recherche. Essayez avec d'autres termes.",
  },
};

export const NoPatients: Story = {
  args: {
    icon: Users,
    title: "Aucun patient",
    description: "Commencez par ajouter votre premier patient.",
    action: <Button>Ajouter un patient</Button>,
  },
};

export const NoDocuments: Story = {
  args: {
    icon: FileText,
    title: "Aucun document",
    description: "Les ordonnances et rapports médicaux apparaîtront ici.",
  },
};
