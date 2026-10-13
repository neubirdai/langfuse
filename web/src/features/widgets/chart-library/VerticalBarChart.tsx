import { useMemo } from "react";

import { BarChart as DesignSystemBarChart } from "@/src/components/design-system/charts/BarChart/BarChart";
import { type ChartProps } from "@/src/features/widgets/chart-library/chart-props";
import { prepareCategoryBars } from "@/src/features/widgets/chart-library/prepareCategoryBars";
import {
  formatMetric,
  toFullMetricString,
} from "@/src/features/widgets/chart-library/utils";
import { useChartTickBudget } from "@/src/features/widgets/chart-library/useChartTickBudget";
import {
  prepareCategoryBars,
  type CategoryBarLegendItem,
} from "@/src/features/widgets/chart-library/prepareCategoryBars";
import { cn } from "@/src/utils/tailwind";

/**
 * Names every bar, in bar order, in ONE row that never wraps. This legend is
 * built for a table strip's 63px band, where the wrapping/scrolling legend the
 * time-series charts use would crowd out the plot it is explaining. Names share
 * the row and ellipsize (full name in `title`), which still identifies runs
 * whose names differ early — as model/prompt variants do.
 */
function CategoryBarLegend({ items }: { items: CategoryBarLegendItem[] }) {
  return (
    <div className="mt-1 flex h-4 min-w-0 shrink-0 items-center gap-x-3 overflow-hidden">
      {items.map((item) => (
        <div key={item.category} className="flex min-w-0 items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span
            className="text-muted-foreground truncate text-xs leading-4"
            title={item.category}
          >
            {item.category}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VerticalBarChart({
  data,
  config,
  metricFormatter = formatMetric,
  hideXAxisLabels = false,
  colorBarsByCategory = false,
  legendPosition,
  zeroBaseline = false,
}: ChartProps) {
  const categoryBars = useMemo(
    () => (colorBarsByCategory ? prepareCategoryBars(data) : null),
    [colorBarsByCategory, data],
  );
  const chartData = useMemo(
    () =>
      (categoryBars?.rows ?? data).map((row, index) => ({
        label: row.dimension ?? "Unknown",
        value: typeof row.metric === "number" ? row.metric : null,
        color: categoryBars?.rows[index]?.fill,
      })),
    [categoryBars, data],
  );
  const formatValue = (value: number) =>
    toFullMetricString(metricFormatter(value, { style: "compact" }));

  return (
    <DesignSystemBarChart
      data={chartData}
      color={config?.metric?.color ?? "hsl(var(--chart-1))"}
      valueFormatter={formatValue}
      hideXAxisLabels={hideXAxisLabels}
      zeroBaseline={zeroBaseline}
      legend={
        colorBarsByCategory && legendPosition !== "none"
          ? {
              items: (categoryBars?.legend ?? []).map((item) => ({
                id: item.category,
                label: item.category,
                color: item.color,
              })),
            }
          : undefined
      }
    />
  );
}
