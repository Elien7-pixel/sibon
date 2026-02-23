import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Moon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPeakSeason, getHolidayName } from "@/utils/southAfricanHolidays";

interface DateInfo {
  date: number;
  available: number;
  isCurrentMonth: boolean;
  seasonType?: "peak" | "offpeak";
}

type Range = {
  start: number;
  end: number;
  startDate?: Date;
  endDate?: Date;
};

type Props = {
  selectedRange: Range;
  onChangeSelectedRange: (range: Range) => void;
  availabilityByDay?: Record<number, { available: number; seasonType?: "peak" | "offpeak" }>;
  maxCapacity?: number;
  onMonthChange?: (year: number, month: number) => void; // month 1-12
  bomaCost?: number;
  bookingType?: "bungalow" | "boma" | "cottage";
  selectedDates?: string[];
  onToggleDate?: (date: string) => void;
  cottageNightlyRate?: number;
};

const Calendar = ({ selectedRange, onChangeSelectedRange, availabilityByDay = {}, maxCapacity = 16, onMonthChange, bomaCost = 0, bookingType = "bungalow", selectedDates = [], onToggleDate, cottageNightlyRate }: Props) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tempStart, setTempStart] = useState<Date | null>(null);

  const maxDate = new Date(today.getFullYear() + 2, today.getMonth(), 0); // 2 years from now

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    if (newDate >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCurrentDate(newDate);
      onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
    }
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    if (newDate <= maxDate) {
      setCurrentDate(newDate);
      onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
    }
  };

  const selectDay = (day: number, dayInfo: DateInfo) => {
    if (!dayInfo.isCurrentMonth || dayInfo.available === 0) return;

    // Check if date is in the past
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    todayStart.setHours(0, 0, 0, 0);
    clickedDate.setHours(0, 0, 0, 0);

    if (clickedDate < todayStart) return;

    if (bookingType === "boma" && onToggleDate) {
      const dateStr = `${clickedDate.getFullYear()}-${String(clickedDate.getMonth() + 1).padStart(2, '0')}-${String(clickedDate.getDate()).padStart(2, '0')}`;
      onToggleDate(dateStr);
      return;
    }

    // If no start date set in this selection flow, start fresh
    if (!tempStart) {
      setTempStart(clickedDate);
      onChangeSelectedRange({
        start: clickedDate.getDate(),
        end: clickedDate.getDate(),
        startDate: clickedDate,
        endDate: clickedDate
      });
      return;
    }

    // We have a start date, now set end date
    if (clickedDate < tempStart) {
      // Clicked earlier than start, swap them
      onChangeSelectedRange({
        start: clickedDate.getDate(),
        end: tempStart.getDate(),
        startDate: clickedDate,
        endDate: tempStart
      });
    } else {
      // Normal case: end after start
      onChangeSelectedRange({
        start: tempStart.getDate(),
        end: day,
        startDate: tempStart,
        endDate: clickedDate
      });
    }
    setTempStart(null); // Reset for next selection
  };

  // Generate calendar days for current month
  const generateCalendarDays = (): DateInfo[] => {
    const days: DateInfo[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month and how many days
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const paddingDays = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1; // Monday start

    for (let i = paddingDays; i > 0; i--) {
      days.push({
        date: prevMonthLastDay - i + 1,
        available: maxCapacity,
        isCurrentMonth: false
      });
    }

    // Current month days
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 1; i <= daysInMonth; i++) {
      const dayData = availabilityByDay[i];
      const currentDay = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

      // Check if date is in the past
      const isPast = currentDay < todayStart;
      const available = isPast ? 0 : (typeof dayData === 'number' ? dayData : (dayData?.available ?? maxCapacity));

      // Determine season using SA holidays logic
      let seasonType: "peak" | "offpeak" | undefined = typeof dayData === 'object' ? dayData?.seasonType : undefined;

      if (!seasonType && !isPast && bookingType === "bungalow") {
        seasonType = isPeakSeason(dateStr) ? 'peak' : 'offpeak';
      }

      days.push({ date: i, available, isCurrentMonth: true, seasonType });
    }

    return days;
  };

  useEffect(() => {
    onMonthChange?.(currentDate.getFullYear(), currentDate.getMonth() + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendarDays = generateCalendarDays();

  const isSelected = (day: number) => {
    if (bookingType === "boma") {
      const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      return selectedDates.includes(dateStr);
    }

    if (!selectedRange.startDate || !selectedRange.endDate) return false;

    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dayDate >= selectedRange.startDate && dayDate <= selectedRange.endDate;
  };

  const isRangeStart = (day: number) => {
    if (!selectedRange.startDate) return false;
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dayDate.getTime() === selectedRange.startDate.getTime();
  };

  const isRangeEnd = (day: number) => {
    if (!selectedRange.endDate) return false;
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dayDate.getTime() === selectedRange.endDate.getTime();
  };

  const getDayClasses = (day: DateInfo) => {
    if (!day.isCurrentMonth) {
      return "text-muted-foreground py-2";
    }

    if (day.available === 0) {
      if (bookingType === "cottage") {
        return "bg-orange-800 rounded-lg p-2 text-center text-white cursor-not-allowed";
      }
      return "bg-gray-500 rounded-lg p-2 text-center text-white cursor-not-allowed";
    }

    const isInRange = isSelected(day.date);
    const isStart = isRangeStart(day.date);
    const isEnd = isRangeEnd(day.date);

    let classes = "p-2 text-center cursor-pointer transition-colors ";

    // Determine background color based on season / type
    let bgColor = "bg-available "; // default
    if (bookingType === "bungalow") {
      if (day.seasonType === "peak") {
        bgColor = "bg-pink-200 hover:bg-pink-300 ";
      } else if (day.seasonType === "offpeak") {
        bgColor = "bg-orange-200 hover:bg-orange-300 ";
      }
    } else if (bookingType === "boma") {
      // For Boma, just use a nice neutral or specific color for available
      bgColor = "bg-orange-100 hover:bg-orange-200 ";
    } else if (bookingType === "cottage") {
      bgColor = "bg-emerald-100 hover:bg-emerald-200 ";
    }

    if (isInRange) {
      if (bookingType === "boma") {
        classes += "bg-orange-400 hover:bg-orange-500 text-white rounded-lg ";
      } else if (bookingType === "cottage") {
        classes += "bg-gray-600 hover:bg-gray-700 text-white ";
        if (isStart) classes += "rounded-l-lg ring-2 ring-gray-700 ";
        if (isEnd) classes += "rounded-r-lg ring-2 ring-gray-700 ";
        if (isStart && isEnd) classes += "rounded-lg ";
      } else {
        classes += "bg-green-200 hover:bg-green-300 ";
        if (isStart) classes += "rounded-l-lg ring-2 ring-green-500 ";
        if (isEnd) classes += "rounded-r-lg ring-2 ring-green-500 ";
        if (isStart && isEnd) classes += "rounded-lg ";
      }
    } else {
      classes += "rounded-lg " + bgColor;
    }

    return classes;
  };

  const nights = (() => {
    if (!selectedRange.startDate || !selectedRange.endDate) return 0;
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(selectedRange.startDate);
    const end = new Date(selectedRange.endDate);
    // Normalize to midnight to avoid DST issues
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = Math.round((end.getTime() - start.getTime()) / msPerDay);
    return Math.max(1, diff);
  })();

  // Calculate total cost
  const calculateTotalCost = () => {
    if (!selectedRange.startDate || !selectedRange.endDate) return 0;

    // Nights between start and end
    const current = new Date(selectedRange.startDate);
    const end = new Date(selectedRange.endDate);

    if (bookingType === "cottage" && cottageNightlyRate) {
      let nightsCount = 0;
      while (current < end) {
        nightsCount += 1;
        current.setDate(current.getDate() + 1);
      }
      return nightsCount * cottageNightlyRate;
    }

    // Default bungalow pricing (peak / low season)
    let total = 0;
    while (current < end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const isPeak = isPeakSeason(dateStr);
      total += isPeak ? 8300 : 4600;
      current.setDate(current.getDate() + 1);
    }

    return total;
  };

  const accommodationCost = bookingType === "bungalow" || bookingType === "cottage" ? calculateTotalCost() : 0;
  const totalCost = accommodationCost + bomaCost;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md w-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Availability</h2>
          <p className="text-sm text-muted-foreground">Select a start and end date</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={goToPreviousMonth}
            disabled={currentDate <= new Date(today.getFullYear(), today.getMonth(), 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-lg px-2">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={goToNextMonth}
            disabled={currentDate >= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground mb-2">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => (
          <div key={index} className={getDayClasses(day)} onClick={() => selectDay(day.date, day)}>
            <div className={`font-semibold ${isSelected(day.date) && day.isCurrentMonth ? "text-gray-900" : ""}`}>
              {day.date}
            </div>
            {day.isCurrentMonth && day.available > 0 && bookingType === "bungalow" && (
              <div className={`text-xs mt-1 ${isSelected(day.date) ? "text-gray-900" : "text-gray-700"}`}>
                {day.seasonType === "peak" ? "Peak" : day.seasonType === "offpeak" ? "Low" : "Available"}
              </div>
            )}
            {day.isCurrentMonth && day.available > 0 && bookingType !== "bungalow" && (
              <div className={`text-xs mt-1 ${isSelected(day.date) ? "text-gray-900" : "text-gray-700"}`}>
                Available
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${bookingType === "cottage" ? "bg-orange-800" : "bg-gray-500"}`}></div>
          <span className="text-muted-foreground">Unavailable</span>
        </div>
        {bookingType === "bungalow" && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-pink-200"></div>
              <span className="text-muted-foreground">Peak Season</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-200"></div>
              <span className="text-muted-foreground">Low Season</span>
            </div>
          </>
        )}
        {bookingType === "boma" && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-100"></div>
            <span className="text-muted-foreground">Available</span>
          </div>
        )}
        {bookingType === "cottage" && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-100"></div>
            <span className="text-muted-foreground">Available</span>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-4">
            {(bookingType === "bungalow" || bookingType === "cottage") && (
              <div className="flex items-center space-x-2">
                <Moon className="h-5 w-5 text-accent" />
                <span className="font-medium">{nights} night{nights > 1 ? "s" : ""}</span>
              </div>
            )}

          </div>
          {totalCost > 0 && (
            <div className="flex flex-col items-end">
              {bomaCost > 0 && bookingType === "bungalow" && (
                <span className="text-xs text-muted-foreground mb-1">
                  (Accommodation: R{accommodationCost.toLocaleString()} + Boma: R{bomaCost.toLocaleString()})
                </span>
              )}
              <div className="bg-hero-brown/10 px-4 py-2 rounded-lg">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-xl font-bold text-hero-brown">R {totalCost.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {bookingType === "boma" && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <span className="font-bold">NB:</span> Only 1 booking per Share Block Unit will be allowed during peak times (Weekends, long weekends) in order to afford other Members the opportunity to book.
        </div>
      )}
    </div>
  );
};

export default Calendar;
