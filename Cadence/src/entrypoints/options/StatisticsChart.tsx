"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, LabelList } from "recharts"
import { useState, useEffect } from "react"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { convertSecondsToHoursMinutesSeconds } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"

import { HistoricalStats } from '../models/HistoricalStats';
import { ChartType } from '../models/ChartType';
import { Settings } from '../models/Settings';

type StatisticsChartProps = {
    historicalStats: HistoricalStats,
    chartType: ChartType,
}

export function StatisticsChart({ historicalStats, chartType }: StatisticsChartProps) {

    const [selectedDay, setSelectedDay] = useState(new Date());
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartConfig, setChartConfig] = useState<ChartConfig>({});
    const [currentDateWindows, setCurrentDateWindows] = useState<string>("");
    const [open, setOpen] = useState(false)
    const [currentChartType, setCurrentChartType] = useState(chartType);

    const showTimeSpent = currentChartType === ChartType.Time;

    const chartOptions = [
        { value: "sessions", label: "Completed Sessions" },
        { value: "time", label: "Time in Focus" }
    ]

    const currentOption = showTimeSpent ? "time" : "sessions"

    // Update local state when prop changes
    useEffect(() => {
        setCurrentChartType(chartType);
    }, [chartType]);

    // Save chart preference when it changes
    const handleChartTypeChange = (value: string) => {
        const newChartType = value === "time" ? ChartType.Time : ChartType.Sessions;
        setCurrentChartType(newChartType);
        
        browser.storage.local.get(['settings'], (result) => {
            const settings = Settings.fromJSON(result.settings || {});
            settings.preferredChartType = newChartType;
            browser.storage.local.set({ settings: settings.toJSON() });
        });
        
        setOpen(false);
    };

    // Helper function to format seconds into hh:mm:ss format
    const formatTimeSpent = (totalSeconds: number): string => {
        if (totalSeconds === 0) return "00:00:00";
        
        const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(totalSeconds);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        calculateChartData();
    }, [selectedDay, historicalStats, currentChartType]);

    const moveBackwards = () => {
        setSelectedDay(new Date(selectedDay.getTime() - 7 * 24 * 60 * 60 * 1000));
    }

    const moveForward = () => {
        setSelectedDay(new Date(selectedDay.getTime() + 7 * 24 * 60 * 60 * 1000));
    }

    const calculateChartData = () => {

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(selectedDay)
            date.setDate(selectedDay.getDate() - i)
            return date.toLocaleDateString('en-CA').slice(0, 10)
        }).reverse()

        const metricKey = showTimeSpent ? "Time" : "Sessions";
        const chartConfig = {
            [metricKey]: {
                label: showTimeSpent ? "Time Spent" : "Sessions",
                color: "hsl(var(--secondary))",
            }
        }

        let chartData: any = [];
        let encounteredMonday = false;
        chartData = last7Days.reverse().map((date) => {
            const dayOfWeek = new Date(date).getDay();
            if (dayOfWeek === 0) {
                encounteredMonday = true;
            }
            const isRecent = !encounteredMonday;

            const data: Record<string, number | string> = {
                day: isRecent && selectedDay.toDateString() === new Date().toDateString()
                    ? new Date(date).toLocaleDateString('en-CA', { weekday: 'long' })
                    : new Date(date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
            };

            if (showTimeSpent) {
                // Calculate total time spent in seconds
                let totalSeconds = 0;
                if (historicalStats && historicalStats.stats && historicalStats.stats[date]) {
                    const sessions = Array.isArray(historicalStats.stats[date]) ? historicalStats.stats[date] : [];
                    totalSeconds = sessions.reduce((sum, session) => {
                        // totalTime is in seconds
                        return sum + (session.totalTime || 0);
                    }, 0);
                }
                data[metricKey] = totalSeconds;
                data[`${metricKey}Display`] = formatTimeSpent(totalSeconds);
            } else {
                // Calculate sessions count
                let sessionsCount = 0;
                if (historicalStats && historicalStats.stats && historicalStats.stats[date]) {
                    sessionsCount = Array.isArray(historicalStats.stats[date]) ? historicalStats.stats[date].length : 0;
                }
                data[metricKey] = sessionsCount;
            }

            return data;
        });

        chartData.reverse();

        const sevenDaysAgo = new Date(selectedDay);
        sevenDaysAgo.setDate(selectedDay.getDate() - 6);
        const currentDateWindows = `
            ${sevenDaysAgo.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })} - 
            ${selectedDay.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`;

        setCurrentDateWindows(currentDateWindows);
        setChartData(chartData);
        setChartConfig(chartConfig);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start space-y-0 pb-2">
                <div>
                    <CardTitle className="text-2xl">
                        {chartOptions.find((option) => option.value === currentOption)?.label}
                    </CardTitle>
                    <CardDescription className="mt-1">{currentDateWindows}</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-48 justify-between"
                            >
                                {chartOptions.find((option) => option.value === currentOption)?.label}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-0">
                            <Command>
                                <CommandList>
                                    <CommandGroup>
                                        {chartOptions.map((option) => (
                                            <CommandItem
                                                key={option.value}
                                                value={option.value}
                                                onSelect={handleChartTypeChange}
                                            >
                                                <Check
                                                    className={`mr-2 h-4 w-4 ${
                                                        currentOption === option.value ? "opacity-100" : "opacity-0"
                                                    }`}
                                                />
                                                {option.label}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <div>
                        <Button className="mr-1" onClick={moveBackwards}> <ChevronLeft className='w-5 h-5' /> </Button>
                        <Button disabled={selectedDay.toDateString() === new Date().toDateString()} onClick={moveForward} > <ChevronRight className='w-5 h-5' /> </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData} margin={{
                        top: 30,
                    }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent 
                            hideLabel 
                            hideIndicator 
                            formatter={(value, name) => {
                                if (showTimeSpent && name === "Time") {
                                    return formatTimeSpent(Number(value));
                                }
                                return value;
                            }}
                        />} />

                        {Object.entries(chartConfig).map(([key, value], index) => {
                            return (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="a"
                                    fill={value.color}
                                    radius={
                                        [4, 4, 4, 4]
                                    }
                                >
                                    {index === Object.keys(chartConfig).length - 1 && <LabelList
                                        position="top"
                                        offset={12}
                                        className="fill-muted-foreground font-geistmono text-sm "
                                        dataKey={showTimeSpent ? `${key}Display` : key}
                                    />}
                                </Bar>
                            )
                        })}
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}