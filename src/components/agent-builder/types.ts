export type TemplateStyle = "modern" | "classic" | "minimal";
export type DevicePreview = "desktop" | "tablet" | "mobile";

export interface ClinicConfig {
  name: string;
  subdomain: string;
  specialty: string;
  city: string;
  phone: string;
  email: string;
  colors: string[];
  template: TemplateStyle;
  services: string[];
}

export function createEmptyConfig(): ClinicConfig {
  return {
    name: "",
    subdomain: "",
    specialty: "",
    city: "",
    phone: "",
    email: "",
    colors: ["#1E40AF", "#3B82F6", "#DBEAFE", "#FFFFFF"],
    template: "modern",
    services: [],
  };
}
