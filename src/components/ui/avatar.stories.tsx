import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar, AvatarFallback } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">FZ</AvatarFallback>
      </Avatar>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">FZ</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>FZ</AvatarFallback>
      </Avatar>
      <Avatar className="h-14 w-14">
        <AvatarFallback className="text-lg">FZ</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const StaffList: Story = {
  render: () => {
    const staff = [
      { initials: "AB", name: "Dr. Ahmed Benali" },
      { initials: "FK", name: "Fatima Khaldi" },
      { initials: "YM", name: "Youssef Mansouri" },
      { initials: "KE", name: "Khadija El Idrissi" },
    ];
    return (
      <div className="flex -space-x-2">
        {staff.map((s) => (
          <Avatar key={s.initials} className="border-2 border-background" title={s.name}>
            <AvatarFallback>{s.initials}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    );
  },
};
