import * as echarts from "echarts/core";
import {
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent
} from "echarts/components";
import {
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  ScatterChart
} from "echarts/charts";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { getERPChartThemes } from "./theme";

let registryInitialized = false;
type EChartsExtensionModule = Extract<Parameters<typeof echarts.use>[0], readonly unknown[]>[number];

export function ensureERPChartRegistry() {
  if (!registryInitialized) {
    echarts.use([
      TitleComponent,
      TooltipComponent,
      GridComponent,
      LegendComponent,
      ToolboxComponent,
      DatasetComponent,
      TransformComponent,
      DataZoomComponent,
      GraphicComponent,
      VisualMapComponent,
      AriaComponent,
      MarkPointComponent,
      MarkLineComponent,
      MarkAreaComponent,
      LineChart,
      BarChart,
      PieChart,
      ScatterChart,
      GaugeChart,
      CanvasRenderer,
      SVGRenderer
    ]);

    const themes = getERPChartThemes();
    Object.entries(themes).forEach(([themeName, themeDefinition]) => {
      echarts.registerTheme(themeName, themeDefinition);
    });

    registryInitialized = true;
  }

  return echarts;
}

export function registerERPChartModules(modules: EChartsExtensionModule[]) {
  if (!modules.length) {
    return echarts;
  }

  ensureERPChartRegistry();
  echarts.use(modules);
  return echarts;
}

export { echarts };
