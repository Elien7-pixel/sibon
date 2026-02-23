import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BookingConfirmed = () => {
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name") || "";
  const type = searchParams.get("type") || "booking";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-green-100 rounded-full p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          {type === "boma" ? "Boma Request Sent!" : type === "cottage" ? "Cottage Booking Request Sent!" : "Booking Request Sent!"}
        </h1>

        <p className="text-muted-foreground text-lg">
          {name ? `Thanks ${name}! ` : ""}Your {type === "boma" ? "boma" : type === "cottage" ? "cottage" : "booking"} request has been received and will be reviewed shortly.
        </p>

        <div className="bg-secondary rounded-md p-4 text-sm text-left space-y-2">
          <p className="font-semibold text-foreground">What happens next?</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>An administrator will review your request</li>
            <li>You'll receive an email confirmation</li>
            <li>Payment details will be sent once approved</li>
          </ol>
        </div>

        <p className="text-sm text-muted-foreground">
          A confirmation email has been sent to your email address.
        </p>

        <Link to="/">
          <Button className="w-full bg-hero-brown hover:bg-hero-brown/90 text-white font-bold py-6 mt-4">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default BookingConfirmed;
