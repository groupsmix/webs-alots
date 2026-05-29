import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { ToastProvider, useToast } from "./toast";

const meta: Meta = {
  title: "UI/Toast",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

function ToastDemo() {
  const { addToast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="success"
        onClick={() => addToast("Rendez-vous confirmé avec succès", "success")}
      >
        Succès
      </Button>
      <Button
        variant="destructive"
        onClick={() => addToast("Erreur lors de l'enregistrement", "error")}
      >
        Erreur
      </Button>
      <Button
        variant="warning"
        onClick={() => addToast("Session expire dans 2 minutes", "warning")}
      >
        Avertissement
      </Button>
      <Button variant="outline" onClick={() => addToast("Nouveau message du patient", "info")}>
        Info
      </Button>
    </div>
  );
}

export const AllTypes: Story = {
  render: () => <ToastDemo />,
};

function ToastWithAction() {
  const { addToast } = useToast();
  return (
    <Button
      onClick={() =>
        addToast("Rendez-vous annulé", "warning", 8000, {
          label: "Annuler",
          onClick: () => addToast("Annulation restaurée", "success"),
        })
      }
    >
      Toast avec action
    </Button>
  );
}

export const WithAction: Story = {
  render: () => <ToastWithAction />,
};
