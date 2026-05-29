import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TableSkeleton, CardSkeleton } from "./loading-skeleton";

const meta: Meta = {
  title: "UI/LoadingSkeleton",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Table: Story = {
  render: () => <TableSkeleton rows={5} columns={4} />,
};

export const TableCompact: Story = {
  render: () => <TableSkeleton rows={3} columns={3} />,
};

export const Cards: Story = {
  render: () => <CardSkeleton count={4} />,
};

export const CardsCompact: Story = {
  render: () => <CardSkeleton count={2} />,
};

export const DashboardLayout: Story = {
  render: () => (
    <div className="space-y-6">
      <CardSkeleton count={4} />
      <TableSkeleton rows={5} columns={5} />
    </div>
  ),
};
