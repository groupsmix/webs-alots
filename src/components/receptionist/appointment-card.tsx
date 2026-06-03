import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  UserX,
  Phone,
  MessageCircle,
  FileText,
  MoreVertical,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppointmentView, PatientView } from "@/lib/data/client";

const statusVariant: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  scheduled: "outline",
  confirmed: "default",
  reminded: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export interface AppointmentCardProps {
  appointment: AppointmentView;
  patient?: PatientView;
  isCheckedIn: boolean;
  onCheckIn: (id: string) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onReschedule: (id: string) => void;
}

export function AppointmentCard({
  appointment: apt,
  patient,
  isCheckedIn,
  onCheckIn,
  onConfirm,
  onCancel,
  onNoShow,
  onReschedule,
}: AppointmentCardProps) {
  const handleCallPatient = () => {
    if (patient?.phone) window.open(`tel:${patient.phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = () => {
    if (patient?.phone) {
      const cleaned = patient.phone.replace(/\s/g, "").replace("+", "");
      window.open(`https://wa.me/${cleaned}`, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-sm font-medium">
          {apt.patientName
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{apt.patientName}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{apt.serviceName}</span>
          <span className="text-xs font-medium text-muted-foreground flex items-center">
            <Clock className="h-3 w-3 mr-1 inline" /> {apt.time}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <Badge
          variant={isCheckedIn ? "success" : statusVariant[apt.status]}
          className="text-[11px] px-2 py-0.5"
        >
          {isCheckedIn ? "Checked In" : apt.status.charAt(0).toUpperCase() + apt.status.slice(1).replace("-", " ")}
        </Badge>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-2 border-l pl-2">
        {!isCheckedIn && apt.status !== "completed" && apt.status !== "cancelled" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-700"
            onClick={() => onCheckIn(apt.id)}
            title="Mark Arrived"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        
        {patient && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-700"
            onClick={handleWhatsApp}
            title="Send WhatsApp Reminder"
          >
            <MessageCircle className="h-4 w-4 text-green-600" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onConfirm(apt.id)} disabled={apt.status === "confirmed"}>
              <CheckCircle className="h-4 w-4 mr-2 text-blue-600" /> Confirm
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReschedule(apt.id)}>
              <Calendar className="h-4 w-4 mr-2" /> Reschedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/receptionist/patients/${apt.patientId}`, "_blank")}>
              <FileText className="h-4 w-4 mr-2" /> Open Patient File
            </DropdownMenuItem>
            {patient && (
              <DropdownMenuItem onClick={handleCallPatient}>
                <Phone className="h-4 w-4 mr-2" /> Call Patient
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNoShow(apt.id)} className="text-destructive focus:text-destructive">
              <UserX className="h-4 w-4 mr-2" /> Mark No-show
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCancel(apt.id)} className="text-destructive focus:text-destructive">
              <XCircle className="h-4 w-4 mr-2" /> Cancel Booking
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
