import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ImageSlideshow from "@/components/ImageSlideshow";

const SignUp = () => {
  const navigate = useNavigate();

  const continueAsGuest = () => {
    navigate("/booking");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Branding with Slideshow */}
      <div className="lg:w-1/2 relative bg-hero-brown text-white overflow-hidden">
        <ImageSlideshow />
        <div className="absolute inset-0 bg-hero-brown/60 z-10" />

        <div className="relative z-20 max-w-md p-8 lg:p-12 flex flex-col justify-center min-h-screen">
          <div className="flex items-center space-x-3 mb-6">
            <img src="/ingwelala-logo.jpeg" alt="Ingwelala Logo" className="h-16 w-16 rounded-lg bg-white p-1 object-contain" />
            <h1 className="text-3xl font-bold">Ingwelala Boma Booking</h1>
          </div>

          <h2 className="text-4xl font-bold mb-4">Welcome to Ingwelala</h2>
          <p className="text-lg opacity-90 mb-6">Your perfect bush getaway awaits. Book your Boma experience today.</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white mt-2" />
              <p>Competitive seasonal rates</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white mt-2" />
              <p>Easy booking with admin approval</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Continue */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Continue</h2>
            <p className="text-muted-foreground">No sign-in required</p>
          </div>

          <Button type="button" variant="outline" onClick={continueAsGuest} className="w-full py-6">
            Continue to booking
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
