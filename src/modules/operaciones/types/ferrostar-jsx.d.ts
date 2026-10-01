import "react";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { FerrostarMap } from "@stadiamaps/ferrostar-webcomponents";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ferrostar-map": DetailedHTMLProps<HTMLAttributes<FerrostarMap>, FerrostarMap> & {
        "show-navigation-ui"?: boolean;
        "show-user-marker"?: boolean;
        system?: "metric" | "imperial" | "imperialWithYards";
      };
    }
  }
}
