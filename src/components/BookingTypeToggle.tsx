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
                size="sm"
                onClick={() => onChange("boma")}
                className="flex-1 sm:flex-none gap-2"
            >
                <Flame className="h-4 w-4" />
                Bomas
            </Button>
            <Button
                variant={value === "cottage" ? "default" : "ghost"}
                size="sm"
                onClick={() => onChange("cottage")}
                className="flex-1 sm:flex-none gap-2"
            >
                <BedDouble className="h-4 w-4" />
                Cottages
            </Button>
        </div>
    );
}
