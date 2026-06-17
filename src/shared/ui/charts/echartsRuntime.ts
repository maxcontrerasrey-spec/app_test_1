import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  MapChart,
  PieChart
} from "echarts/charts";
import {
  GeoComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  MapChart,
  PieChart,
  GeoComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer
]);

export { echarts };
