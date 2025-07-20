"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, LabelList } from "recharts"

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


type SessionsPerDayProps = {
    historicalStats: Record<string, Record<string, number>>,
}

export function SessionsPerDayChart({ historicalStats }: SessionsPerDayProps) {

    const [selectedDay, setSelectedDay] = useState(new Date());
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartConfig, setChartConfig] = useState<ChartConfig>({});
    const [currentDateWindows, setCurrentDateWindows] = useState<string>("");

    useEffect(() => {
        calculateChartData();
    }, [selectedDay, historicalStats]);

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



        const chartConfig = {
            "Sessions": {
                label: "Sessions",
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

            data["Sessions"] = historicalStats[date] ? historicalStats[date].length : 0;

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
                    <CardTitle className="text-2xl">Completed Sessions</CardTitle>
                    <CardDescription className="mt-1">{currentDateWindows}</CardDescription>
                </div>
                <div>
                    <Button className="mr-1" onClick={moveBackwards}> <ChevronLeft className='w-5 h-5' /> </Button>
                    <Button disabled={selectedDay.toDateString() === new Date().toDateString()} onClick={moveForward} > <ChevronRight className='w-5 h-5' /> </Button>
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
                        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator />} />

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