// Type declaration for swagger-ui-react
declare module "swagger-ui-react" {
  import { ComponentType } from "react";

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    [key: string]: unknown;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}