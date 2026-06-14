import * as echarts from 'echarts/core';
import { MapChart, PieChart } from 'echarts/charts';
import { GeoComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  PieChart,
  MapChart,
  GeoComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { echarts };
export type { ECharts } from 'echarts/core';
