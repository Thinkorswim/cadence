import './style.css';
import '~/assets/global.css';
import { Button } from '@/components/ui/button'
import { Dot, ChartNoAxesColumn, Info, Pencil } from 'lucide-react'
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RoundSlider, ISettingsPointer } from 'mz-react-round-slider';
import { Input } from '@/components/ui/input';
import { SessionsPerDayChart } from './SessionsPerDayChart';
import { Settings } from '../models/Settings';
import { Session } from '../models/Session';
import { TimerState } from '../models/TimerState';
import { DailyStats } from '../models/DailyStats';
import { HistoricalStats } from '../models/HistoricalStats';

function Options() {

  // Define the list of texts
  const ctaDiscordTexts: string[] = [
    'Have a question? Join the',
    'Need help? Join the',
    'Have a suggestion? Join the',
    'Want to chat? Join the',
    'Like productivity? Join the',
    'Have feedback? Join the',
  ];

  const selectRandomText = () => {
    const randomIndex = Math.floor(Math.random() * ctaDiscordTexts.length);
    setCtaDiscordTexts(ctaDiscordTexts[randomIndex]);
  };

  const [breakAutoStart, setBreakAutoStart] = useState(false);
  const [focusAutoStart, setFocusAutoStart] = useState(false);

  // State to store the selected text
  const [ctaDiscordText, setCtaDiscordTexts] = useState<string>('');

  const [focusTime, setFocusTime] = useState(25 * 60); // 25 minutes in seconds
  const [breakTime, setBreakTime] = useState(5 * 60); // 5 minutes in seconds

  const [focusTimeDialogOpen, setFocusTimeDialogOpen] = useState(false);
  const [shortBreakDialogOpen, setShortBreakDialogOpen] = useState(false);

  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  const [activeTab, setActiveTab] = useState<string>('settings');
  const [historicalStats, setHistoricalStats] = useState<HistoricalStats>(new HistoricalStats());

  const [focusTimeCircle, setFocusTimeCircle] = useState<ISettingsPointer[]>([
    {
      value: Math.floor(focusTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  const [breakTimeCircle, setBreakTimeCircle] = useState<ISettingsPointer[]>([
    {
      value: Math.floor(breakTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  useEffect(() => {
    // Select a random text for the CTA Discord
    selectRandomText();

    // Load settings from browser storage
    browser.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        const settings = result.settings;
        setFocusAutoStart(settings.focusAutoStart);
        setBreakAutoStart(settings.breakAutoStart);
        setFocusTime(settings.focusTime);
        setBreakTime(settings.shortBreakTime);
      }
    });

  }, []);


  // Get the colors from CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const primary = getComputedStyle(root).getPropertyValue('--primary').trim().split(' ');
    setPrimaryColor("hsl(" + primary[0] + "," + primary[1] + "," + primary[2] + ")");

    const secondary = getComputedStyle(root).getPropertyValue('--secondary').trim().split(' ');
    setSecondaryColor(`hsla(${secondary[0]},${secondary[1]},${secondary[2]},0.2)`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && section == "statistics") {
      setActiveTab("statistics");
      handleStatisticsLoad();
    }
  }, []);


  const handleStatisticsLoad = () => {
    browser.storage.local.get(['dailyStats', 'historicalStats'], (data) => {
      const dailyStatistics: DailyStats = DailyStats.fromJSON(data.dailyStats) || new DailyStats();
      const historicalStatsObj: HistoricalStats = HistoricalStats.fromJSON(data.historicalStats);

      // Save completed sessions for the current date
      historicalStatsObj.stats[dailyStatistics.date] = dailyStatistics.completedSessions ? dailyStatistics.completedSessions : [];

      browser.storage.local.set({ historicalStats: historicalStatsObj.toJSON() });

      setHistoricalStats(historicalStatsObj);
    });
  }


  const handleSaveFocusTime = () => {
    browser.storage.local.get(['settings', 'session'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      const session: Session = Session.fromJSON(data.session) || new Session();

      settings.focusTime = focusTime;
      if (session.timerState === TimerState.Focus) {
        session.totalTime = focusTime;
      }

      browser.storage.local.set({ settings: settings.toJSON(), session: session.toJSON() }, () => {
        setFocusTimeDialogOpen(false);
      });
    });
  };

  const handleSaveBreakTime = () => {
    browser.storage.local.get(['settings', 'session'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      const session: Session = Session.fromJSON(data.session) || new Session();

      settings.shortBreakTime = breakTime;
      if (session.timerState === TimerState.ShortBreak) {
        session.totalTime = breakTime;
      }
      
      browser.storage.local.set({ settings: settings.toJSON(), session: session.toJSON() }, () => {
        setShortBreakDialogOpen(false);
      });
    });
  };


  const handleToggleAutoStartFocus = (checked: boolean) => {
    setFocusAutoStart(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.focusAutoStart = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleToggleBreakAutoStart = (checked: boolean) => {
    setBreakAutoStart(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.breakAutoStart = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }



  return (
    <>
      <div className='px-10 flex flex-col min-h-screen max-w-screen-lg mx-auto font-geist'>
        <div className="flex-grow">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className='mt-8 mb-10 flex items-center'>
              <img src="/images/logo.svg" alt="Logo" className="w-10 h-10 mr-4" />

              <TabsList className='py-5 px-2'>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="statistics" onClick={handleStatisticsLoad}><ChartNoAxesColumn className='w-5 h-5 mr-1' /> Statistics </TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="settings" ><SettingsIcon className='w-5 h-5 mr-1' />  Settings</TabsTrigger>
              </TabsList>
            </div>

            {/* STATISTICS TAB */}
            <TabsContent value="statistics">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Statistics
                </div>
                <div className='mt-6 bg-muted p-5 rounded-xl'>
                  <SessionsPerDayChart historicalStats={historicalStats} />
                </div>
              </div>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Settings
                </div>

                <div className='mt-6 bg-muted p-5 rounded-xl'>
                  <div className="flex items-center justify-between max-w-[300px]">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="autoStartFocus">Focus Time</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            The amount of time you want to focus before taking a break.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center text-base cursor-pointer" onClick={() => { setFocusTimeDialogOpen(true) }} >
                      <div>
                        {focusTime / 60} minutes
                      </div>
                      <Pencil className="ml-2 w-4 h-4 text-primary" />
                    </div>

                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="autoStartFocus">Break Time</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            The amount of time you want to take a break between focus sessions.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center text-base cursor-pointer" onClick={() => { setShortBreakDialogOpen(true) }}>
                      <div>
                        {breakTime / 60} minutes
                      </div>
                      <Pencil className="ml-2 w-4 h-4 text-primary" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="focusAutoStart">Auto-start Focus Sessions</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Automatically start a focus session after a break.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="focusAutoStart"
                      className='data-[state=unchecked]:bg-white'
                      checked={focusAutoStart}
                      onCheckedChange={handleToggleAutoStartFocus}
                    />
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="breakAutoStart">Auto-start Breaks</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Automatically start a break after a focus session.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="breakAutoStart"
                      className='data-[state=unchecked]:bg-white'
                      checked={breakAutoStart}
                      onCheckedChange={handleToggleBreakAutoStart}
                    />
                  </div>
                </div>


              </div>
            </TabsContent>
          </Tabs>
        </div >

        <Dialog open={focusTimeDialogOpen} onOpenChange={() => { setFocusTimeDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Focus Time</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 relative">
                  <div className='left-[17px] relative'>
                    <RoundSlider
                      pointers={focusTimeCircle}
                      onChange={(updated) => {
                        setFocusTime(updated[0].value as number * 60);

                      }}
                      pathStartAngle={270}
                      pathEndAngle={269.999}
                      hideText={true}
                      pathRadius={130}
                      pathThickness={12}
                      pathBgColor={secondaryColor}
                      connectionBgColor={primaryColor}
                      pointerBgColor={"#f48b85"}
                      pointerBgColorSelected={"#f48b85"}
                      min={0}
                      max={120}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "42%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <Input
                            className='w-16 no-arrows text-center md:text-base font-medium'
                            type="number"
                            style={{ MozAppearance: 'textfield' }}
                            value={focusTime / 60}
                            onChange={(e) => {
                              setFocusTime(Math.min(Number(e.target.value), 120) * 60);
                              setFocusTimeCircle([{
                                value: Math.min(Number(e.target.value), 120),
                              }]);
                            }}
                            min={0}
                            max={1200}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <div className='mb-1 ml-2 text-lg'>minutes</div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveFocusTime() }}> Save Focus Time </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={shortBreakDialogOpen} onOpenChange={() => { setShortBreakDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Break Time</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 relative">
                  <div className='left-[17px] relative'>
                    <RoundSlider
                      pointers={breakTimeCircle}
                      onChange={(updated) => {
                        setBreakTime(updated[0].value as number * 60);
                      }}
                      pathStartAngle={270}
                      pathEndAngle={269.999}
                      hideText={true}
                      pathRadius={130}
                      pathThickness={12}
                      pathBgColor={secondaryColor}
                      connectionBgColor={primaryColor}
                      pointerBgColor={"#f48b85"}
                      pointerBgColorSelected={"#f48b85"}
                      min={0}
                      max={60}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "42%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <Input
                            className='w-16 no-arrows text-center md:text-base font-medium'
                            type="number"
                            style={{ MozAppearance: 'textfield' }}
                            value={breakTime / 60}
                            onChange={(e) => {
                              setBreakTime(Math.min(Number(e.target.value), 60) * 60);
                              setBreakTimeCircle([{
                                value: Math.min(Number(e.target.value), 60),
                              }]);
                            }}
                            min={0}
                            max={60 * 60}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <div className='mb-1 ml-2 text-lg'>minutes</div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveBreakTime() }}> Save Break Time </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <footer className="bg-muted rounded-t-lg py-5 px-8 mt-10">
          <div className="container mx-auto flex justify-between items-center text-xs">
            <div className="flex items-center text-secondary font-semibold"> <img src="/images/gm_logo_red.svg" alt="Grounded Momentum Logo" className="w-6 h-6 mr-2" /> Grounded Momentum <Dot className='w-2 h-2 mx-1' /> 2025 </div>
            <div className="flex items-center text-secondary font-semibold">
              {ctaDiscordText}
              <div className='flex items-center'>
                <Button className="ml-3 rounded-lg" onClick={() => { window.open("https://discord.gg/SvTsqKwsgN", "_blank") }}>  <img height="20" width="20" className="mr-1 color-white" src="https://cdn.simpleicons.org/discord/ffffff" /> Discord </Button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default Options;