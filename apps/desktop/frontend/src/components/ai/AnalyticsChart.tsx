import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChartSpec } from '@/lib/aiSchemas'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

function downloadChartXlsx(chart: ChartSpec) {
    const sheet = XLSX.utils.json_to_sheet(chart.data)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, chart.title.slice(0, 31))
    XLSX.writeFile(book, `${chart.id || 'chart'}.xlsx`)
}

export function AnalyticsChart({ chart }: { chart: ChartSpec }) {
    const yKey = chart.yKeys[0]

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">{chart.title}</CardTitle>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadChartXlsx(chart)}>
                    <Download className="mr-2 size-4" />
                    Excel
                </Button>
            </CardHeader>
            <CardContent className="h-72">
                <ResponsiveContainer
                    width="100%"
                    height="100%">
                    {chart.type === 'pie' ? (
                        <PieChart>
                            <Pie
                                data={chart.data}
                                dataKey={yKey}
                                nameKey={chart.xKey}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                label>
                                {chart.data.map((_, index) => (
                                    <Cell
                                        key={index}
                                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    ) : chart.type === 'bar' ? (
                        <BarChart data={chart.data}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                            />
                            <XAxis
                                dataKey={chart.xKey}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {chart.yKeys.map((key, i) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                            ))}
                        </BarChart>
                    ) : chart.type === 'area' ? (
                        <AreaChart data={chart.data}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                            />
                            <XAxis
                                dataKey={chart.xKey}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {chart.yKeys.map((key, i) => (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={PIE_COLORS[i % PIE_COLORS.length]}
                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                    fillOpacity={0.25}
                                />
                            ))}
                        </AreaChart>
                    ) : (
                        <LineChart data={chart.data}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                            />
                            <XAxis
                                dataKey={chart.xKey}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {chart.yKeys.map((key, i) => (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={PIE_COLORS[i % PIE_COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            ))}
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
