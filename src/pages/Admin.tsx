import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Users, CheckCircle, XCircle, Edit, Trash2, Search, ChevronLeft, ChevronRight, Lock, DollarSign, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { isPeakSeason } from "@/utils/southAfricanHolidays";

const Admin = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Doc<"bookings"> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 10)); // November 2025
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [maxCapacityLocal, setMaxCapacityLocal] = useState<number>(16);
  const [calendarMode, setCalendarMode] = useState<"boma" | "cottage">("boma");
  const [selectedBoma, setSelectedBoma] = useState<"Argyle" | "Platform" | "Beacon">("Argyle");
  const [selectedCottage, setSelectedCottage] = useState<"Hornbill Cottage" | "Francolin Cottage" | "Guineafowl Cottage">("Hornbill Cottage");

  // Queries
  const settings = useQuery(api.availability.getSettings, {});
  const bookings = useQuery(api.bookings.list, {});
  const monthAvail = useQuery(api.availability.getMonthAvailability, {
    year: currentMonth.getFullYear(),
    month: currentMonth.getMonth() + 1,
  });

  // Helpers: parse/format dates (YYYY-MM-DD <-> dd/mm/yyyy)
  const formatDDMMYYYY = (isoDate: string) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };
  const parseLocal = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const toISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const computeNights = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    const start = parseLocal(checkIn);
    const end = parseLocal(checkOut);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000*60*60*24));
    return Math.max(1, diff);
  };

  const computeTotalCost = (booking: Doc<"bookings">) => {
    const { checkIn, checkOut, bomaDates, type, unitName } = booking;
    if (!checkIn || !checkOut) return 0;

    const start = parseLocal(checkIn);
    const end = parseLocal(checkOut);
    let total = 0;

    if (!type || type === "bungalow") {
      // Bungalow pricing: peak / low season per night
      const cur = new Date(start);
      while (cur < end) {
        const dateStr = toISO(cur);
        total += isPeakSeason(dateStr) ? 8300 : 4600;
        cur.setDate(cur.getDate() + 1);
      }
    } else if (type === "cottage") {
      // Cottage pricing: flat nightly rate per cottage
      const nights = computeNights(checkIn, checkOut);
      let rate = 0;
      if (unitName === "Hornbill Cottage") rate = 1200;
      else if (unitName === "Francolin Cottage") rate = 2000;
      else if (unitName === "Guineafowl Cottage") rate = 2500;
      total += nights * rate;
    }

    // Add Argyle Boma add-on for bungalow bookings
    if (bomaDates && bomaDates.length > 0) {
      total += bomaDates.length * 350;
    }
    return total;
  };

  // Mutations
  const approve = useMutation(api.bookings.updateStatus);
  const updateBooking = useMutation(api.bookings.updateBooking);
  const removeBooking = useMutation(api.bookings.remove);
  const completeStay = useMutation(api.bookings.completeStay);
  const setMaxCapacity = useMutation(api.availability.setMaxCapacity);
  const setDateAvailability = useMutation(api.availability.setDateAvailability);

  const [adminKey, setAdminKeyLocal] = useState<string | null>(localStorage.getItem("adminKey") || null);

  const isConfigured = useQuery(api.admin.isConfigured, {});
  const setAdminKeyMutation = useMutation(api.admin.setAdminKey);
  const sendEmail = useAction(api.emails.sendNotification);

  const maxCapacity = settings?.maxCapacity ?? 16;

  // Sync local max capacity display
  if (maxCapacityLocal !== maxCapacity) {
    // keep input in sync without causing render loops by checking inequality
    setTimeout(() => setMaxCapacityLocal(maxCapacity), 0);
  }

  const availability = useMemo(() => monthAvail ?? {}, [monthAvail]);

  const filteredBookings = (bookings ?? []).filter((booking) => {
    const name = booking.userName ?? "";
    const email = booking.userEmail ?? "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const accommodationBookings = useMemo(() => {
    return filteredBookings.filter(b => (!b.type || b.type === "bungalow"));
  }, [filteredBookings]);

  const cottageBookings = useMemo(() => {
    return filteredBookings.filter(b => b.type === "cottage");
  }, [filteredBookings]);

  const bomaBookings = useMemo(() => {
    return filteredBookings.filter(b => (b.type === "boma" || (b.bomaDates && b.bomaDates.length > 0)));
  }, [filteredBookings]);

  const handleApprove = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await approve({ id, status: "approved", adminKey: adminKey ?? undefined });
      
      // Send approval email
      const booking = bookings?.find(b => b._id === id);
      if (booking?.userEmail && booking?.userName) {
        sendEmail({
          type: "booking_approved",
          name: booking.userName,
          email: booking.userEmail,
          details: `${booking.unitName || "Booking"}, Check-in: ${booking.checkIn}`,
        }).catch(() => {});
      }
      
      toast.success("Booking approved successfully");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to approve booking: " + msg);
      }
    }
  };

  const handleReject = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await approve({ id, status: "rejected", adminKey: adminKey ?? undefined });
      
      // Send rejection email
      const booking = bookings?.find(b => b._id === id);
      if (booking?.userEmail && booking?.userName) {
        sendEmail({
          type: "booking_rejected" as any,
          name: booking.userName,
          email: booking.userEmail,
          details: `${booking.unitName || "Booking"}, Check-in: ${booking.checkIn}`,
        }).catch(() => {});
      }
      
      toast.success("Booking rejected");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to reject booking: " + msg);
      }
    }
  };

  const handleRequestPayment = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await approve({ id, status: "payment_requested", adminKey: adminKey ?? undefined });
      toast.success("Payment request sent");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to request payment: " + msg);
      }
    }
  };

  const handlePaymentReceived = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await approve({ id, status: "payment_received", adminKey: adminKey ?? undefined });
      toast.success("Payment received marked");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to mark payment received: " + msg);
      }
    }
  };

  const handleConfirm = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await approve({ id, status: "confirmed", adminKey: adminKey ?? undefined });
      toast.success("Booking confirmed! Dates are now blocked.");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to confirm booking: " + msg);
      }
    }
  };

  const handleCompleteStay = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await completeStay({ id, adminKey: adminKey ?? undefined });
      toast.success("Stay marked as completed. 1-year cooldown started.");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to complete stay: " + msg);
      }
    }
  };

  const handleDelete = async (id: Id<"bookings">) => {
    try {
      if (isConfigured && !adminKey) {
        toast.error("Please enter the admin key");
        return;
      }
      await removeBooking({ id, adminKey: adminKey ?? undefined });
      toast.success("Booking deleted");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to delete booking: " + msg);
      }
    }
  };

  const handleEditBooking = (booking: Doc<"bookings">) => {
    setSelectedBooking(booking);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      if (selectedBooking) {
        await updateBooking({
          id: selectedBooking._id,
          checkIn: selectedBooking.checkIn,
          checkOut: selectedBooking.checkOut,
          guests: selectedBooking.guests,
          notes: selectedBooking.notes,
          adminKey: adminKey ?? undefined,
        });
        toast.success("Booking updated successfully");
        setIsEditDialogOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to update booking: " + msg);
      }
    }
  };

  const getStatusBadge = (status: "pending" | "approved" | "rejected" | "payment_requested" | "payment_received" | "confirmed") => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case "payment_requested":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <DollarSign className="w-3 h-3 mr-1" />
            Payment Requested
          </span>
        );
      case "payment_received":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Check className="w-3 h-3 mr-1" />
            Payment Received
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/30 text-accent-foreground">
            <CalendarIcon className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  const pendingCount = (bookings ?? []).filter((b) => b.status === "pending").length;
  const approvedCount = (bookings ?? []).filter((b) => b.status === "approved").length;

  // Calendar functions
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: "",
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({
        date: dateStr,
        day,
        isCurrentMonth: true,
      });
    }

    return days;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsCalendarDialogOpen(true);
  };


  const handleBlockDate = async () => {
    try {
      if (selectedDate) {
        if (calendarMode === "boma") {
          const bomaFieldMap: Record<string, string> = {
            "Argyle": "bomaBlocked",
            "Platform": "platformBlocked",
            "Beacon": "beaconBlocked"
          };
          const blockedField = bomaFieldMap[selectedBoma] || "bomaBlocked";
          const args: any = { date: selectedDate, adminKey: adminKey ?? undefined };
          args[blockedField] = true;
          await setDateAvailability(args);
        } else if (calendarMode === "cottage") {
          const cottageFieldMap: Record<string, string> = {
            "Hornbill Cottage": "hornbillBlocked",
            "Francolin Cottage": "francolinBlocked",
            "Guineafowl Cottage": "guineafowlBlocked"
          };
          const blockedField = cottageFieldMap[selectedCottage] || "hornbillBlocked";
          const args: any = { date: selectedDate, adminKey: adminKey ?? undefined };
          args[blockedField] = true;
          await setDateAvailability(args);
        }
        toast.success(`${calendarMode === "boma" ? selectedBoma : selectedCottage} blocked`);
        setIsCalendarDialogOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to block date: " + msg);
      }
    }
  };

  const handleUnblockDate = async () => {
    try {
      if (selectedDate) {
        if (calendarMode === "boma") {
          const bomaFieldMap: Record<string, string> = {
            "Argyle": "bomaBlocked",
            "Platform": "platformBlocked",
            "Beacon": "beaconBlocked"
          };
          const blockedField = bomaFieldMap[selectedBoma] || "bomaBlocked";
          
          const args: any = { date: selectedDate, adminKey: adminKey ?? undefined };
          args[blockedField] = false;
          await setDateAvailability(args);
        } else if (calendarMode === "cottage") {
          const cottageFieldMap: Record<string, string> = {
            "Hornbill Cottage": "hornbillBlocked",
            "Francolin Cottage": "francolinBlocked",
            "Guineafowl Cottage": "guineafowlBlocked"
          };
          const blockedField = cottageFieldMap[selectedCottage] || "hornbillBlocked";
          const args: any = { date: selectedDate, adminKey: adminKey ?? undefined };
          args[blockedField] = false;
          await setDateAvailability(args);
        }
        toast.success(`${calendarMode === "boma" ? selectedBoma : selectedCottage} unblocked`);
        setIsCalendarDialogOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      if (msg.includes("Forbidden")) {
        toast.error("Invalid Admin Key. Please re-enter your key.");
      } else {
        toast.error("Failed to unblock date: " + msg);
      }
    }
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-hero-brown text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center space-x-4">
          <img src="/ingwelala-logo.jpeg" alt="Ingwelala Logo" className="h-14 w-14 rounded-lg bg-white p-1 object-contain" />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm opacity-90 mt-1">Manage bookings and availability for Ingwelala Booking</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Admin key prompt */}
        <div className="mb-4 bg-card p-4 rounded-md border">
          {isConfigured ? (
            <div className="flex gap-2 items-center">
              <input
                type="password"
                placeholder="Enter admin key"
                className="border rounded px-3 py-2 w-64"
                onChange={(e) => setAdminKeyLocal(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (adminKey) {
                    localStorage.setItem("adminKey", adminKey);
                    toast.success("Admin key saved locally");
                  }
                }}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="password"
                placeholder="Set new admin key"
                className="border rounded px-3 py-2 w-64"
                onChange={(e) => setAdminKeyLocal(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!adminKey) return;
                  await setAdminKeyMutation({ adminKey });
                  toast.success("Admin key configured");
                }}
              >
                Configure
              </Button>
            </div>
          )}
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg shadow-md border-l-4 border-accent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-3xl font-bold mt-1">{pendingCount}</p>
              </div>
              <CalendarIcon className="h-10 w-10 text-accent" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-md border-l-4 border-available-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Bookings</p>
                <p className="text-3xl font-bold mt-1">{approvedCount}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-available-foreground" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-md border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Capacity</p>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={maxCapacityLocal}
                    onChange={(e) => setMaxCapacityLocal(parseInt(e.target.value) || 0)}
                    onBlur={(e) => setMaxCapacity({ maxCapacity: parseInt((e.target as HTMLInputElement).value) || 0, adminKey: adminKey ?? undefined })}
                    className="w-20 h-10 text-xl font-bold"
                    min="1"
                    max="50"
                  />
                  <span className="text-sm text-muted-foreground">guests</span>
                </div>
              </div>
              <Users className="h-10 w-10 text-primary" />
            </div>
          </div>
        </div>

        {/* Calendar Availability Management */}
        <div className="bg-card rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Calendar Availability</h2>
              <p className="text-sm text-muted-foreground mt-1">Click on any date to adjust availability</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-secondary rounded-lg p-1 flex text-sm">
                <button
                  onClick={() => setCalendarMode("boma")}
                  className={`px-3 py-1.5 rounded-md transition-all ${calendarMode === "boma" ? "bg-background shadow text-orange-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Boma
                </button>
                <button
                  onClick={() => setCalendarMode("cottage")}
                  className={`px-3 py-1.5 rounded-md transition-all ${calendarMode === "cottage" ? "bg-background shadow text-emerald-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Cottages
                </button>
              </div>
              {calendarMode === "boma" && (
                <div className="bg-secondary rounded-lg p-1 flex text-sm ml-2">
                  <button
                    onClick={() => setSelectedBoma("Argyle")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedBoma === "Argyle" ? "bg-background shadow text-orange-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Argyle
                  </button>
                  <button
                    onClick={() => setSelectedBoma("Platform")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedBoma === "Platform" ? "bg-background shadow text-orange-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Platform
                  </button>
                  <button
                    onClick={() => setSelectedBoma("Beacon")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedBoma === "Beacon" ? "bg-background shadow text-orange-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Beacon
                  </button>
                </div>
              )}
              {calendarMode === "cottage" && (
                <div className="bg-secondary rounded-lg p-1 flex text-sm ml-2">
                  <button
                    onClick={() => setSelectedCottage("Hornbill Cottage")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedCottage === "Hornbill Cottage" ? "bg-background shadow text-emerald-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Hornbill
                  </button>
                  <button
                    onClick={() => setSelectedCottage("Francolin Cottage")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedCottage === "Francolin Cottage" ? "bg-background shadow text-emerald-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Francolin
                  </button>
                  <button
                    onClick={() => setSelectedCottage("Guineafowl Cottage")}
                    className={`px-3 py-1.5 rounded-md transition-all ${selectedCottage === "Guineafowl Cottage" ? "bg-background shadow text-emerald-700 font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Guineafowl
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-lg px-4">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {generateCalendarDays().map((day, index) => {
              if (!day.isCurrentMonth) {
                return (
                  <div key={index} className="p-2 text-center text-muted-foreground">
                    {day.day}
                  </div>
                );
              }

              const dateAvail = availability[day.date];
              const isAccommodationBlocked = dateAvail?.blocked || dateAvail?.available === 0;
              
              let isBlocked = false;
              if (calendarMode === "boma") {
                const bomaFieldMap: Record<string, string> = {
                  "Argyle": "bomaBlocked",
                  "Platform": "platformBlocked",
                  "Beacon": "beaconBlocked"
                };
                const blockedField = bomaFieldMap[selectedBoma] || "bomaBlocked";
                isBlocked = (dateAvail as any)?.[blockedField];
              } else if (calendarMode === "cottage") {
                const cottageFieldMap: Record<string, string> = {
                  "Hornbill Cottage": "hornbillBlocked",
                  "Francolin Cottage": "francolinBlocked",
                  "Guineafowl Cottage": "guineafowlBlocked"
                };
                const blockedField = cottageFieldMap[selectedCottage] || "hornbillBlocked";
                isBlocked = (dateAvail as any)?.[blockedField];
              }

              const bgColor = isBlocked 
                ? (calendarMode === "boma" ? "bg-orange-200" : "bg-emerald-200")
                : (calendarMode === "boma" ? "bg-background border border-orange-100 hover:bg-orange-50" : "bg-background border border-emerald-100 hover:bg-emerald-50");

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day.date)}
                  className={`p-3 text-center rounded-lg transition-all hover:ring-2 hover:ring-primary cursor-pointer ${bgColor}`}
                >
                  <div className="font-semibold">{day.day}</div>
                  {isBlocked && (
                    <div className={`text-xs mt-1 flex items-center justify-center ${calendarMode === "boma" ? "text-orange-700" : "text-emerald-700"}`}>
                      <Lock className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              {calendarMode === "boma" ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-orange-100 bg-background" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-200" />
                    <span>Boma Booked/Blocked</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-emerald-100 bg-background" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-200" />
                    <span>Cottage Booked/Blocked</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

          {/* Accommodation Bookings Table */}
          <div className="bg-card rounded-lg shadow-md p-6 mb-8 hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-2xl font-semibold">Accommodation Requests</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Bungalow</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accommodationBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No accommodation bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    accommodationBookings.map((booking: Doc<"bookings">) => (
                      <TableRow key={booking._id}>
                        <TableCell className="font-medium">{booking.userName ?? "-"}</TableCell>
                        <TableCell>
                          {booking.bungalowNumber ?? "-"}
                          {booking.bomaDates && booking.bomaDates.length > 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              +{booking.bomaDates.length} Boma
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{booking.userType ?? "-"}</TableCell>
                        <TableCell>{formatDDMMYYYY(booking.checkIn)}</TableCell>
                        <TableCell>{formatDDMMYYYY(booking.checkOut)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-right">
                            <span className="font-semibold text-hero-brown">R {computeTotalCost(booking).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">{computeNights(booking.checkIn, booking.checkOut)} night(s)</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              {booking.status === "pending" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleApprove(booking._id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReject(booking._id)} className="text-destructive">
                                    <XCircle className="h-4 w-4 mr-2" /> Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "approved" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleRequestPayment(booking._id)}>
                                    <Send className="h-4 w-4 mr-2" /> Request Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "payment_requested" && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePaymentReceived(booking._id)}>
                                    <DollarSign className="h-4 w-4 mr-2" /> Mark Payment Received
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "payment_received" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleConfirm(booking._id)}>
                                    <Check className="h-4 w-4 mr-2" /> Confirm Booking
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "confirmed" && !booking.stayCompletedAt && (
                                <>
                                  <DropdownMenuItem onClick={() => handleCompleteStay(booking._id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Complete Stay
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleEditBooking(booking)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(booking._id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Cottage Bookings Table */}
          <div className="bg-card rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Cottage Requests</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cottage</TableHead>
                    <TableHead>Bungalow No.</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cottageBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No cottage bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    cottageBookings.map((booking: Doc<"bookings">) => (
                      <TableRow key={booking._id}>
                        <TableCell className="font-medium">{booking.userName ?? "-"}</TableCell>
                        <TableCell>{booking.userEmail ?? "-"}</TableCell>
                        <TableCell>{booking.unitName ?? "-"}</TableCell>
                        <TableCell>{booking.bungalowNumber ?? "-"}</TableCell>
                        <TableCell>{formatDDMMYYYY(booking.checkIn)}</TableCell>
                        <TableCell>{formatDDMMYYYY(booking.checkOut)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-hero-brown">R {computeTotalCost(booking).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">{computeNights(booking.checkIn, booking.checkOut)} night(s)</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              {booking.status === "pending" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleApprove(booking._id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReject(booking._id)} className="text-destructive">
                                    <XCircle className="h-4 w-4 mr-2" /> Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "approved" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleRequestPayment(booking._id)}>
                                    <Send className="h-4 w-4 mr-2" /> Request Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "payment_requested" && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePaymentReceived(booking._id)}>
                                    <DollarSign className="h-4 w-4 mr-2" /> Mark Payment Received
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "payment_received" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleConfirm(booking._id)}>
                                    <Check className="h-4 w-4 mr-2" /> Confirm Booking
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {booking.status === "confirmed" && !booking.stayCompletedAt && (
                                <>
                                  <DropdownMenuItem onClick={() => handleCompleteStay(booking._id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Complete Stay
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleEditBooking(booking)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(booking._id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
              </TableBody>
              </Table>
            </div>
          </div>

          {/* Boma Bookings Table */}
          <div className="bg-card rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6">Boma Requests</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Boma</TableHead>
                    <TableHead>Bungalow No.</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomaBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No boma bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    bomaBookings.map((booking: Doc<"bookings">) => {
                      const isBomaOnly = booking.type === "boma";
                      const bomaName = booking.unitName || (isBomaOnly ? booking.bungalowNumber : "Argyle");
                      
                      // Calculate specific boma cost
                      let bomaCost = 0;
                      if (isBomaOnly) {
                        bomaCost = computeNights(booking.checkIn, booking.checkOut) * 350;
                      } else if (booking.bomaDates) {
                        bomaCost = booking.bomaDates.length * 350;
                      }

                      // Format dates
                      let dateDisplay;
                      if (isBomaOnly) {
                         // List all dates in range
                         const start = parseLocal(booking.checkIn);
                         const end = parseLocal(booking.checkOut);
                         const dates = [];
                         for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
                           dates.push(toISO(d));
                         }
                         dateDisplay = dates.map(formatDDMMYYYY).join(", ");
                      } else {
                         dateDisplay = booking.bomaDates?.map(formatDDMMYYYY).join(", ") ?? "-";
                      }

                      return (
                        <TableRow key={booking._id}>
                          <TableCell className="font-medium">{booking.userName ?? "-"}</TableCell>
                          <TableCell>{booking.userEmail ?? "-"}</TableCell>
                          <TableCell>{bomaName}</TableCell>
                          <TableCell>{booking.bungalowNumber ?? "-"}</TableCell>
                          <TableCell className="max-w-xs break-words">{dateDisplay}</TableCell>
                          <TableCell>
                          <div className="flex flex-col text-right">
                            <span className="font-semibold text-hero-brown">R {bomaCost.toLocaleString()}</span>
                          </div>
                        </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline">Actions</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {booking.status === "pending" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleApprove(booking._id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReject(booking._id)} className="text-destructive">
                                      <XCircle className="h-4 w-4 mr-2" /> Reject
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {booking.status === "approved" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleRequestPayment(booking._id)}>
                                      <Send className="h-4 w-4 mr-2" /> Request Payment
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {booking.status === "payment_requested" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handlePaymentReceived(booking._id)}>
                                      <DollarSign className="h-4 w-4 mr-2" /> Mark Payment Received
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {booking.status === "payment_received" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleConfirm(booking._id)}>
                                      <Check className="h-4 w-4 mr-2" /> Confirm Booking
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {booking.status === "confirmed" && !booking.stayCompletedAt && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleCompleteStay(booking._id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Complete Stay
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => handleEditBooking(booking)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(booking._id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
      </main>

      {/* Calendar Edit Dialog */}
      <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Date</DialogTitle>
            <DialogDescription>
              {selectedDate ? formatDDMMYYYY(selectedDate) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const av = availability[selectedDate];
                  if (calendarMode === "boma") {
                    const bomaFieldMap: Record<string, string> = {
                      "Argyle": "bomaBlocked",
                      "Platform": "platformBlocked",
                      "Beacon": "beaconBlocked"
                    };
                    const blockedField = bomaFieldMap[selectedBoma] || "bomaBlocked";
                    const isBomaBlocked = (av as any)?.[blockedField];
                    
                    return isBomaBlocked ? `${selectedBoma} is currently blocked.` : `${selectedBoma} is currently available.`;
                  } else {
                    const cottageFieldMap: Record<string, string> = {
                      "Hornbill Cottage": "hornbillBlocked",
                      "Francolin Cottage": "francolinBlocked",
                      "Guineafowl Cottage": "guineafowlBlocked"
                    };
                    const blockedField = cottageFieldMap[selectedCottage] || "hornbillBlocked";
                    const isCottageBlocked = (av as any)?.[blockedField];
                    
                    return isCottageBlocked ? `${selectedCottage} is currently blocked.` : `${selectedCottage} is currently available.`;
                  }
                })()}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedDate && (
              (calendarMode === "boma" && (availability[selectedDate] as any)?.[(selectedBoma === "Argyle" ? "bomaBlocked" : selectedBoma === "Platform" ? "platformBlocked" : "beaconBlocked")]) ||
              (calendarMode === "cottage" && (availability[selectedDate] as any)?.[(selectedCottage === "Hornbill Cottage" ? "hornbillBlocked" : selectedCottage === "Francolin Cottage" ? "francolinBlocked" : "guineafowlBlocked")])
            ) ? (
              <Button onClick={handleUnblockDate} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                Unblock {calendarMode === "boma" ? selectedBoma : selectedCottage}
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleBlockDate} className="w-full sm:w-auto">
                <Lock className="h-4 w-4 mr-2" /> Block {calendarMode === "boma" ? selectedBoma : selectedCottage}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsCalendarDialogOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>Make changes to the booking details below.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {selectedBooking.type === "boma" ? (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-checkin">Date</Label>
                    <Input
                      id="edit-checkin"
                      type="date"
                      value={selectedBooking.checkIn}
                      min={toISO(new Date())}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const d = parseLocal(newDate);
                        if (!isNaN(d.getTime())) {
                          // For Boma single day, update both checkIn and checkOut
                          // checkOut is typically next day for logic consistency, or same day if logic supports it
                          // Current logic uses checkIn -> checkOut range.
                          // Boma single day usually implies checkIn=Date, checkOut=NextDate.
                          const nextDay = new Date(d);
                          nextDay.setDate(d.getDate() + 1);
                          setSelectedBooking({ ...selectedBooking, checkIn: newDate, checkOut: toISO(nextDay) });
                        }
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-checkin">Check-in</Label>
                      <Input
                        id="edit-checkin"
                        type="date"
                        value={selectedBooking.checkIn}
                        min={toISO(new Date())}
                        onChange={(e) => {
                          const newIn = e.target.value;
                          let newOut = selectedBooking.checkOut;
                          const di = parseLocal(newIn);
                          const do_ = parseLocal(newOut);
                          if (!isNaN(di.getTime()) && !isNaN(do_.getTime()) && do_ <= di) {
                            const adj = new Date(di);
                            adj.setDate(adj.getDate() + 1);
                            newOut = toISO(adj);
                          }
                          setSelectedBooking({ ...selectedBooking, checkIn: newIn, checkOut: newOut });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-checkout">Check-out</Label>
                      <Input
                        id="edit-checkout"
                        type="date"
                        value={selectedBooking.checkOut}
                        min={selectedBooking.checkIn}
                        onChange={(e) => {
                          let newOut = e.target.value;
                          const di = parseLocal(selectedBooking.checkIn);
                          const do_ = parseLocal(newOut);
                          if (!isNaN(di.getTime()) && !isNaN(do_.getTime()) && do_ <= di) {
                            const adj = new Date(di);
                            adj.setDate(adj.getDate() + 1);
                            newOut = toISO(adj);
                          }
                          setSelectedBooking({ ...selectedBooking, checkOut: newOut });
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-guests">Number of Guests</Label>
                <Input
                  id="edit-guests"
                  type="number"
                  value={selectedBooking.guests}
                  onChange={(e) => setSelectedBooking({ ...selectedBooking, guests: parseInt(e.target.value) })}
                  min="1"
                  max={maxCapacity}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-hero-brown hover:bg-hero-brown/90">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
