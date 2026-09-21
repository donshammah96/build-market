"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { use } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export type OrderChartType = {
  month: string;
  total: number;
  successful: number;
};

const chartConfig = {
  total: {
    label: "Total",
    color: "var(--admin-color-accent)",
  },
  successful: {
    label: "Successful",
    color: "var(--admin-color-success)",
  },
} satisfies ChartConfig;

const AppBarChart = ({
  dataPromise,
}: {
  dataPromise: Promise<OrderChartType[]>;
}) => {
  const chartData = use(dataPromise);
  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6 text-(--admin-color-text-primary)">
        Total Revenue
      </h1>
      <ChartContainer config={chartConfig} className="min-h-50 w-full">
        <BarChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <YAxis tickLine={false} tickMargin={10} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          <Bar dataKey="successful" fill="var(--color-successful)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
};

export default AppBarChart;
