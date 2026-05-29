import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Consultation Générale</CardTitle>
        <CardDescription>Dr. Ahmed Benali — Cabinet Dr. Ahmed</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Durée: 30 min · Prix: 200 MAD</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Réserver</Button>
      </CardFooter>
    </Card>
  ),
};

export const AppointmentCard: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Rendez-vous #1042</CardTitle>
        <CardDescription>Lundi 15 mars 2026 à 10:30</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span>Fatima Zahra El Amrani</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span>Consultation générale</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assurance</span>
            <span>CNSS</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1">
          Annuler
        </Button>
        <Button variant="success" className="flex-1">
          Confirmer
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const StatsCard: Story = {
  render: () => (
    <Card className="w-[200px]">
      <CardHeader>
        <CardDescription>Rendez-vous aujourd&apos;hui</CardDescription>
        <CardTitle className="text-3xl">24</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-green-600">+12% vs semaine dernière</p>
      </CardContent>
    </Card>
  ),
};
