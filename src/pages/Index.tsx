import { useMemo, useState } from "react";
import BookingHeader from "@/components/BookingHeader";
import Calendar from "@/components/Calendar";
import BookingForm from "@/components/BookingForm";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookingTypeToggle } from "@/components/BookingTypeToggle";

const Index = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 2);
  const [selectedRange, setSelectedRange] = useState({
    start: today.getDate(),
    end: today.getDate() + 2,
    startDate: today,
    endDate: tomorrow
  });
  const [bomaDates, setBomaDates] = useState<string[]>([]);
  const [bookingType, setBookingType] = useState<"boma" | "cottage">("boma");

  const toggleBomaDate = (dateStr: string) => {
    let newDates;
    if (bookingType === "boma") {
      // Enforce single night selection for standalone Boma bookings
      if (bomaDates.includes(dateStr)) {
        newDates = []; // Deselect if same date clicked
      } else {
        newDates = [dateStr]; // Select new date (replaces any existing selection)
      }
    } else {
      // Original logic for add-ons or other types (if applicable)
      if (bomaDates.includes(dateStr)) {
        newDates = bomaDates.filter(d => d !== dateStr);
      } else {
        newDates = [...bomaDates, dateStr].sort();
      }
    }
    setBomaDates(newDates);

    // Update selectedRange to reflect the boma dates
    // This ensures the booking form displays the correct date range
    if (newDates.length > 0) {
      const sorted = [...newDates].sort();
      const start = new Date(sorted[0]);
      const end = new Date(sorted[sorted.length - 1]);
      // Add 1 day to end for checkout display logic (since range is usually start->end exclusive of end night, 
      // but here we selected specific days. If I select 29th, I want to book 29th. 
      // BookingForm typically shows checkin 29, checkout 30 for 1 night.
      end.setDate(end.getDate() + 1);
      
      setSelectedRange({
        startDate: start,
        endDate: end,
        start: start.getDate(),
        end: end.getDate()
      });
    }
  };

  const [selectedBoma, setSelectedBoma] = useState<"Argyle" | "Platform" | "Beacon">("Argyle");
  type CottageKey = "Hornbill" | "Francolin" | "Guineafowl";
  const [selectedCottage, setSelectedCottage] = useState<CottageKey>("Hornbill");

  const cottageConfig: Record<CottageKey, { name: string; rate: number; maxGuests: number; description: string }> = {
    Hornbill: {
      name: "Hornbill Cottage",
      rate: 1200,
      maxGuests: 2,
      description:
        "This guest cottage is available to Ingwelala Members only. It is an open plan rondavel with two single beds and small kitchen/dining area. There is a seperate bathroom with shower & toilet facilities. A braai is provided on the outside patio.",
    },
    Francolin: {
      name: "Francolin Cottage",
      rate: 2000,
      maxGuests: 4,
      description:
        "This guest cottage is available to Ingwelala Members only. It has two bedrooms, each with 2 singles beds and a bathroom (shower & toilet). Facilities include a kitchen/dining area and an outside gazebo with braai.",
    },
    Guineafowl: {
      name: "Guineafowl Cottage",
      rate: 2500,
      maxGuests: 6,
      description:
        "This guest cottage is available to Ingwelala Members only. One room offers a queen bed with en suite bathroom (bath & toilet). The other room has four single beds with a bathroom (shower & toilet). Facilities include a kitchen, dining area and gazebo.",
    },
  };

  const settings = useQuery(api.availability.getSettings, {});
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const avail = useQuery(api.availability.getMonthAvailability, {
    year: viewYear,
    month: viewMonth
  });

  const availabilityByDay = useMemo(() => {
    const map: Record<number, { available: number; seasonType?: "peak" | "offpeak" }> = {};
    if (avail) {
      Object.entries(avail).forEach(([date, value]) => {
        const day = Number(date.split("-")[2]);
        let available = value.available;

        if (bookingType === "boma" || bookingType === "cottage") {
           // If it's boma or cottage, we reset available to max first,
           // then apply specific block.
           available = settings?.maxCapacity ?? 16;
           
           if (bookingType === "boma") {
              const bomaFieldMap: Record<string, string> = {
                "Argyle": "bomaBlocked",
                "Platform": "platformBlocked",
                "Beacon": "beaconBlocked"
              };
              const blockedField = bomaFieldMap[selectedBoma] || "bomaBlocked";
              if ((value as any)[blockedField]) available = 0;
           } else {
              const cottageFieldMap: Record<string, string> = {
                "Hornbill": "hornbillBlocked",
                "Francolin": "francolinBlocked",
                "Guineafowl": "guineafowlBlocked"
              };
              // The selectedCottage state is keys: Hornbill, Francolin, Guineafowl
              const blockedField = cottageFieldMap[selectedCottage] || "hornbillBlocked";
              if ((value as any)[blockedField]) available = 0;
           }
        }

        map[day] = {
          available,
          seasonType: value.seasonType
        };
      });
    }
    return map;
  }, [avail, bookingType, settings, selectedBoma, selectedCottage]);

  const maxCapacity = settings?.maxCapacity ?? 16;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BookingHeader />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-end mb-4">
          <Button asChild variant="outline">
            <Link to="/admin">Go to Admin</Link>
          </Button>
        </div>

        <div className="flex justify-center mb-6">
          <BookingTypeToggle value={bookingType} onChange={setBookingType} />
        </div>

        {/* Pricing Information */}
        <div className="bg-card rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Pricing</h2>
          {bookingType === "bungalow" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-pink-300 rounded-lg p-4 bg-pink-50">
                <h3 className="font-semibold text-lg text-pink-800 mb-2">Peak Season Rate</h3>
                <p className="text-sm text-muted-foreground mb-2">Weekends (Fri-Sun), school holidays & public holidays</p>
                <p className="text-3xl font-bold text-pink-900">R 8,300<span className="text-lg font-normal text-muted-foreground">/night</span></p>
              </div>
              <div className="border-2 border-orange-300 rounded-lg p-4 bg-orange-50">
                <h3 className="font-semibold text-lg text-orange-800 mb-2">Low Season Rate</h3>
                <p className="text-sm text-muted-foreground mb-2">Midweek (Mon-Thu), excluding public holidays</p>
                <p className="text-3xl font-bold text-orange-900">R 4,600<span className="text-lg font-normal text-muted-foreground">/night</span></p>
              </div>
            </div>
          )}
          {bookingType === "boma" && (
            <>
              <p className="text-sm text-muted-foreground mb-4">Select which Boma you would like to book:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all h-full flex flex-col justify-between ${selectedBoma === "Argyle"
                    ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                    : "border-border bg-background hover:border-orange-300"
                    }`}
                  onClick={() => setSelectedBoma("Argyle")}
                >
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Argyle Boma</h3>
                  </div>
                  <p className="text-3xl font-bold text-orange-900 mt-2">R 350<span className="text-lg font-normal text-muted-foreground">/night</span></p>
                </div>

                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all h-full flex flex-col justify-between ${selectedBoma === "Platform"
                    ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                    : "border-border bg-background hover:border-orange-300"
                    }`}
                  onClick={() => setSelectedBoma("Platform")}
                >
                  <div>
                    <h3 className="font-semibold text-lg mb-2">The Platform</h3>
                  </div>
                  <p className="text-3xl font-bold text-orange-900 mt-2">R 600<span className="text-lg font-normal text-muted-foreground">/night</span></p>
                </div>

                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all h-full flex flex-col justify-between ${selectedBoma === "Beacon"
                    ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                    : "border-border bg-background hover:border-orange-300"
                    }`}
                  onClick={() => setSelectedBoma("Beacon")}
                >
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Beacon Boma</h3>
                  </div>
                  <p className="text-3xl font-bold text-orange-900 mt-2">R 500<span className="text-lg font-normal text-muted-foreground">/night</span></p>
                </div>
            </div>
            </>
          )}
          {bookingType === "cottage" && (
            <>
              <p className="text-sm text-muted-foreground mb-4">Select which Cottage you would like to book:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["Hornbill", "Francolin", "Guineafowl"] as CottageKey[]).map((key) => {
                  const cfg = cottageConfig[key];
                  return (
                    <div
                      key={key}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all h-full flex flex-col justify-between ${selectedCottage === key
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                        : "border-border bg-background hover:border-emerald-300"}
                      `}
                      onClick={() => setSelectedCottage(key)}
                    >
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{cfg.name}</h3>
                      </div>
                      <p className="text-3xl font-bold text-emerald-900 mt-2">R {cfg.rate.toLocaleString()}<span className="text-lg font-normal text-muted-foreground">/night</span></p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm text-muted-foreground">
            {bookingType === "bungalow" && (
              <p>• Flat rate for up to 16 guests</p>
            )}
            <p>• Admin approval required for all bookings</p>
            <p>• Payment confirmation required before dates are reserved</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-stretch">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Calendar
              selectedRange={selectedRange}
              onChangeSelectedRange={setSelectedRange}
              availabilityByDay={availabilityByDay}
              maxCapacity={maxCapacity}
              onMonthChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
              bomaCost={bookingType === "boma" ? bomaDates.length * (selectedBoma === "Argyle" ? 350 : selectedBoma === "Platform" ? 600 : 500) : bomaDates.length * 350}
              bookingType={bookingType}
              selectedDates={bomaDates}
              onToggleDate={toggleBomaDate}
              cottageNightlyRate={bookingType === "cottage" ? cottageConfig[selectedCottage].rate : undefined}
            />
            {bookingType === "boma" && (
              <div className="bg-card rounded-lg shadow-md p-6 border border-border/50">
                {selectedBoma === "Argyle" && (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Argyle Boma</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This boma, overlooking the Shlaralumi River with magnificent sunsets, is a ten minute drive from the main camp. It is a popular venue for sun-downers or an "off-bungalow" braai, but has no water. It also boasts a "long-drop" loo with a spectacular view!
                    </p>
                    <div className="mt-auto pt-4 border-t border-border">
                      <p className="font-semibold text-primary">Cost: R350,00 <span className="font-normal text-muted-foreground">- per afternoon/evening braai (incl. firewood)</span></p>
                    </div>
                  </>
                )}
                {selectedBoma === "Platform" && (
                  <>
                    <h3 className="text-xl font-semibold mb-2">The Platform</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Situated on the banks of the Shlaralumi River on Buffelsbed. A huge canopy of trees covers a sleeping platform situated above a boma. 10 Mattresses are at hand as well as an open-air shower and toilet. Pack your sleeping bags, food and drinks, and leave early to enjoy the sunset. Just don't be too surprised if you can't get down in the morning 'cos a pride of lions moved in overnight!
                    </p>
                    <div className="mt-auto pt-4 border-t border-border">
                      <p className="font-semibold text-primary">Cost: R600,00 <span className="font-normal text-muted-foreground">- per night, incl. firewood</span></p>
                    </div>
                  </>
                )}
                {selectedBoma === "Beacon" && (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Beacon Boma</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Situated at the border of the Kruger National Park on Buffelsbed in thick bush, this boma is the furthest facility from the main camp. Overnight facilities include a platform that can accommodate up to 8 people on mattresses that are supplied. A "long-drop" loo and bucket shower is also available. Since the boma has no running water, 2 canisters of water will be available at reception when collecting keys and braai wood.
                    </p>
                    <div className="mt-auto pt-4 border-t border-border">
                      <p className="font-semibold text-primary">Cost: R500,00 <span className="font-normal text-muted-foreground">- per night, incl. firewood and water</span></p>
                    </div>
                  </>
                )}
              </div>
            )}
            {bookingType === "cottage" && (
              <div className="bg-card rounded-lg shadow-md p-6 border border-border/50">
                {(() => {
                  const cfg = cottageConfig[selectedCottage];
                  return (
                    <>
                      <h3 className="text-xl font-semibold mb-2">{cfg.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{cfg.description}</p>
                      <div className="mt-auto pt-4 border-t border-border">
                        <p className="font-semibold text-primary">
                          Cost: R{cfg.rate.toLocaleString()}.00 <span className="font-normal text-muted-foreground">- per night</span>
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          </div>
          <div className="flex">
            <BookingForm
              year={today.getFullYear()}
              month={today.getMonth() + 1}
              selectedRange={selectedRange}
              bomaDates={bomaDates}
              onBomaDatesChange={setBomaDates}
              type={bookingType}
              selectedBoma={selectedBoma}
              selectedCottage={selectedCottage}
              onDateChange={(start, end) => {
                if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  const s = new Date(start);
                  let e = new Date(end);
                  // normalize to midnight
                  s.setHours(0, 0, 0, 0);
                  e.setHours(0, 0, 0, 0);
                  if (e <= s) {
                    e = new Date(s);
                    e.setDate(s.getDate() + 1);
                  }
                  // Filter out any boma dates that are no longer in range
                  const formatDate = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  };

                  const newStartStr = formatDate(s);
                  const newEndStr = formatDate(e);
                  setBomaDates(prev => prev.filter(d => d >= newStartStr && d < newEndStr));

                  setSelectedRange({
                    start: s.getDate(),
                    end: e.getDate(),
                    startDate: s,
                    endDate: e
                  });
                }
              }}
            />
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6 mt-8">
        © 2025 Ingwelala Boma & Cottage Booking
      </footer>
    </div>
  );
};

export default Index;
