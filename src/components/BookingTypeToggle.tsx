import { Button } from "@/components/ui/button";
import { Home, Flame, BedDouble } from "lucide-react";

type BookingType = "boma" | "cottage";

interface BookingTypeToggleProps {
    value: BookingType;
    onChange: (value: BookingType) => void;
}

export function BookingTypeToggle({ value, onChange }: BookingTypeToggleProps) {
    return (
        <div className="flex p-1 bg-muted rounded-lg mb-6 w-full sm:w-auto self-center">
            <Button
                variant={value === "boma" ? "default" : "ghost"}
                size="lg"
                onClick={() => onChange("boma")}
                className="flex-1 sm:flex-none gap-2 text-lg py-6 px-8"
            >
                <Flame className="h-5 w-5" />
                Bomas
            </Button>
            <Button
                variant={value === "cottage" ? "default" : "ghost"}
                size="lg"
                onClick={() => onChange("cottage")}
                className="flex-1 sm:flex-none gap-2 text-lg py-6 px-8"
            >
                <BedDouble className="h-5 w-5" />
                Cottages
            </Button>
        </div>
    );
}
