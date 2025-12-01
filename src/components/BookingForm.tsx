import { useMemo, useState } from "react";
import { Calendar, Home, FileText, Shield, CheckCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Props = {
  year: number; // e.g. 2025
  month: number; // 1-12
  selectedRange: {
    start: number;
    end: number;
    startDate?: Date;
    endDate?: Date;
  };
  onDateChange?: (start: Date, end: Date) => void;
  bomaDates: string[];
  onBomaDatesChange: (dates: string[]) => void;
  type?: "boma" | "cottage";
  selectedBoma?: "Argyle" | "Platform" | "Beacon";
  selectedCottage?: "Hornbill" | "Francolin" | "Guineafowl";
};

const BookingForm = ({ year, month, selectedRange, onDateChange, bomaDates, onBomaDatesChange, type = "boma", selectedBoma = "Argyle", selectedCottage }: Props) => {
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bungalowNumber, setBungalowNumber] = useState("");
  const [userType, setUserType] = useState<"owner" | "registered">("owner");
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState("");
  const [manualCheckOut, setManualCheckOut] = useState("");
  const createBooking = useMutation(api.bookings.createBooking);
  const settings = useQuery(api.availability.getSettings, {});

  const parseLocalDate = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const formatDDMMYYYY = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const { checkIn, checkOut } = useMemo(() => {
    // Use manual dates if set, otherwise use selected range
    if (manualCheckIn && manualCheckOut) {
      return { checkIn: manualCheckIn, checkOut: manualCheckOut };
    }

    if (selectedRange.startDate && selectedRange.endDate) {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const ci = formatDate(selectedRange.startDate);
      const co = formatDate(selectedRange.endDate);
      return { checkIn: ci, checkOut: co };
    }

    // Fallback for when dates aren't set yet
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ci = today.toISOString().split('T')[0];
    const co = tomorrow.toISOString().split('T')[0];
    return { checkIn: ci, checkOut: co };
  }, [selectedRange, manualCheckIn, manualCheckOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    if (!bungalowNumber) {
      toast.error("Please enter your bungalow number");
      return;
    }
    setSubmitting(true);
    try {
      const cottageName = selectedCottage === "Hornbill" ? "Hornbill Cottage" : selectedCottage === "Francolin" ? "Francolin Cottage" : selectedCottage === "Guineafowl" ? "Guineafowl Cottage" : undefined;
      await createBooking({
        checkIn,
        checkOut,
        bungalowNumber,
        unitName:
          type === "boma"
            ? selectedBoma
            : type === "cottage" && cottageName
            ? cottageName
            : undefined,
        userType,
        notes: notes || undefined,
        userEmail: email,
        userName: name,
        bomaDates,
        type
      });
      toast.success("Booking request submitted!", {
        description: "An admin will review your request shortly.",
      });
      setNotes("");
      onBomaDatesChange([]);
      setSuccessOpen(true);
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to submit booking";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const maxCapacity = settings?.maxCapacity ?? 16;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md w-full flex flex-col">
      <h2 className="text-xl font-semibold mb-6">
        {type === "boma" ? "Book Boma" : "Book Ingwelala Cottage"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {type === "cottage" && (
          <>
            <div>
              <label htmlFor="arrivalDate" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                Arrival Date
              </label>
              <Input
                id="arrivalDate"
                type="date"
                value={checkIn}
                onChange={(e) => {
                  setManualCheckIn(e.target.value);
                  if (e.target.value && checkOut && onDateChange) {
                    const start = parseLocalDate(e.target.value);
                    const end = parseLocalDate(checkOut);
                    onDateChange(start, end);
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="bg-background"
              />
            </div>

            <div>
              <label htmlFor="departureDate" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                Departure Date
              </label>
              <Input
                id="departureDate"
                type="date"
                value={checkOut}
                onChange={(e) => {
                  setManualCheckOut(e.target.value);
                  if (checkIn && e.target.value && onDateChange) {
                    const start = parseLocalDate(checkIn);
                    const end = parseLocalDate(e.target.value);
                    onDateChange(start, end);
                  }
                }}
                min={checkIn}
                className="bg-background"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="name" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
            <User className="h-4 w-4 mr-2 text-muted-foreground" />
            Name
          </label>
          <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" required />
        </div>

        <div>
          <label htmlFor="email" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
            <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
            Email
          </label>
          <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" required />
        </div>

        <div>
          <label htmlFor="bungalowNumber" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
            <Home className="h-4 w-4 mr-2 text-muted-foreground" />
            Bungalow Number
          </label>
          <Input
            id="bungalowNumber"
            type="text"
            placeholder="e.g., B12"
            value={bungalowNumber}
            onChange={(e) => setBungalowNumber(e.target.value)}
            className="bg-background"
            required
          />
        </div>

        {type === "boma" || type === "cottage" ? (
          <></>
        ) : (
          <div>
            <label htmlFor="userType" className="flex items-center text-sm font-medium text-foreground/70 mb-1">
              <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
              Status
            </label>
            <Select value={userType} onValueChange={(value: "owner" | "registered") => setUserType(value)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="registered">Registered User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-hero-brown hover:bg-hero-brown/90 text-white font-bold py-6 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Request Booking"}
        </Button>

        <div className="flex items-start bg-available/30 p-4 rounded-lg">
          <Shield className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
          <div>
            <p className="font-semibold text-primary">Heads up!</p>
            <p className="text-sm text-available-foreground">Booking requests require admin approval and payment confirmation before dates are reserved.</p>
          </div>
        </div>
      </form>
      {/* Success Splash */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-available-foreground" />
              {type === "boma" ? "Boma Request Sent" : type === "cottage" ? "Cottage Booking Request Sent" : "Booking Request Sent"}
            </DialogTitle>
            <DialogDescription>
              {type === "boma"
                ? `Thanks ${name || ""}! Your Boma request has been received and will be reviewed shortly.`
                : type === "cottage"
                ? `Thanks ${name || ""}! Your cottage booking request has been received and will be reviewed shortly.`
                : `Thanks ${name || ""}! We’ve received your request and an admin will review it shortly.`}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary rounded-md p-4 text-sm">
            {type === "boma" ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Boma</span><span className="font-medium">{selectedBoma}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">Date</span><span className="font-medium">{formatDDMMYYYY(parseLocalDate(checkIn))}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">Total Cost</span><span className="font-medium text-primary">R {((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) * (selectedBoma === "Argyle" ? 350 : selectedBoma === "Platform" ? 600 : 500)}</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Arrival</span><span className="font-medium">{formatDDMMYYYY(parseLocalDate(checkIn))}</span></div>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">Departure</span><span className="font-medium">{formatDDMMYYYY(parseLocalDate(checkOut))}</span></div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Cottage</span>
                  <span className="font-medium">
                    {type === "cottage"
                      ? (selectedCottage === "Hornbill"
                          ? "Hornbill Cottage"
                          : selectedCottage === "Francolin"
                          ? "Francolin Cottage"
                          : selectedCottage === "Guineafowl"
                          ? "Guineafowl Cottage"
                          : "Cottage")
                      : bungalowNumber}
                  </span>
                </div>
                {type === "cottage" && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="font-medium text-primary">
                      R {((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) * (selectedCottage === "Hornbill" ? 1200 : selectedCottage === "Francolin" ? 2000 : 2500)}
                    </span>
                  </div>
                )}
                {type === "bungalow" && (
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">Status</span><span className="font-medium">{userType === "owner" ? "Owner" : "Registered User"}</span></div>
                )}
                {bomaDates.length > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Argyle Boma</span>
                    <span className="font-medium text-primary">{bomaDates.length} night(s) requested</span>
                  </div>
                )}
              </>
            )}
            {notes && (
              <div className="mt-2">
                <div className="text-muted-foreground">Note</div>
                <div className="font-medium whitespace-pre-wrap">{notes}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)} className="bg-hero-brown hover:bg-hero-brown/90">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingForm;
