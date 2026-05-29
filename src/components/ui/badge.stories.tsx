import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "success", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Confirmé" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "En attente" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Annulé" },
};

export const Success: Story = {
  args: { variant: "success", children: "Payé" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "En retard" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "CNSS" },
};

export const AppointmentStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Confirmé</Badge>
      <Badge variant="secondary">En attente</Badge>
      <Badge variant="warning">En retard</Badge>
      <Badge variant="destructive">Annulé</Badge>
      <Badge variant="outline">CNSS</Badge>
      <Badge variant="outline">CNOPS</Badge>
      <Badge variant="outline">AMO</Badge>
      <Badge variant="outline">RAMED</Badge>
    </div>
  ),
};
