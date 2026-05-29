import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="upcoming" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="upcoming">À venir</TabsTrigger>
        <TabsTrigger value="past">Passés</TabsTrigger>
        <TabsTrigger value="cancelled">Annulés</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming">
        <p className="text-sm text-muted-foreground p-4">3 rendez-vous à venir cette semaine.</p>
      </TabsContent>
      <TabsContent value="past">
        <p className="text-sm text-muted-foreground p-4">12 rendez-vous passés ce mois.</p>
      </TabsContent>
      <TabsContent value="cancelled">
        <p className="text-sm text-muted-foreground p-4">2 annulations ce mois.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const DoctorSchedule: Story = {
  render: () => (
    <Tabs defaultValue="today" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
        <TabsTrigger value="week">Cette semaine</TabsTrigger>
        <TabsTrigger value="month">Ce mois</TabsTrigger>
      </TabsList>
      <TabsContent value="today">
        <div className="space-y-2 p-4 text-sm">
          <div className="flex justify-between">
            <span>09:00</span>
            <span>Fatima Z. — Consultation</span>
          </div>
          <div className="flex justify-between">
            <span>10:00</span>
            <span>Youssef M. — Suivi</span>
          </div>
          <div className="flex justify-between">
            <span>11:00</span>
            <span>Khadija B. — Consultation</span>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="week">
        <p className="text-sm text-muted-foreground p-4">18 rendez-vous cette semaine.</p>
      </TabsContent>
      <TabsContent value="month">
        <p className="text-sm text-muted-foreground p-4">72 rendez-vous ce mois.</p>
      </TabsContent>
    </Tabs>
  ),
};
