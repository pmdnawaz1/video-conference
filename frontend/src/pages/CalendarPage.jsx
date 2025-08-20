import React, { useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  FiPlus,
  FiCalendar,
  FiClock,
  FiUsers,
  FiVideo,
  FiEdit,
  FiTrash2,
} from "react-icons/fi";
import useAuthStore from "../stores/authStore";
import "../react-big-calendar.css";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CalendarPage = () => {
  const { user } = useAuthStore();
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sample events data - replace with actual API calls
  useEffect(() => {
    const sampleEvents = [
      {
        id: "1",
        title: "Team Standup",
        start: new Date(2024, 11, 20, 9, 0),
        end: new Date(2024, 11, 20, 9, 30),
        resource: {
          type: "meeting",
          status: "scheduled",
          participants: 5,
          isRecurring: true,
          meetingId: "meeting-1",
          description: "Daily team standup meeting",
        },
      },
      {
        id: "2",
        title: "Client Presentation",
        start: new Date(2024, 11, 22, 14, 0),
        end: new Date(2024, 11, 22, 15, 30),
        resource: {
          type: "meeting",
          status: "scheduled",
          participants: 8,
          isRecurring: false,
          meetingId: "meeting-2",
          description: "Quarterly client presentation and review",
        },
      },
      {
        id: "3",
        title: "All Hands Meeting",
        start: new Date(2024, 11, 25, 10, 0),
        end: new Date(2024, 11, 25, 11, 0),
        resource: {
          type: "meeting",
          status: "scheduled",
          participants: 25,
          isRecurring: false,
          meetingId: "meeting-3",
          description: "Monthly company-wide meeting",
        },
      },
    ];

    setTimeout(() => {
      setEvents(sampleEvents);
      setLoading(false);
    }, 1000);
  }, []);

  const eventStyleGetter = (event, start, end, isSelected) => {
    const style = {
      backgroundColor: "#3b82f6",
      borderRadius: "4px",
      opacity: 0.8,
      color: "white",
      border: "0px",
      display: "block",
    };

    if (event.resource?.status === "completed") {
      style.backgroundColor = "#10b981";
    } else if (event.resource?.status === "cancelled") {
      style.backgroundColor = "#ef4444";
      style.opacity = 0.6;
    }

    return { style };
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleSelectSlot = ({ start, end }) => {
    // Open create modal with selected time slot
    setSelectedEvent({
      start,
      end,
      title: "",
      resource: {
        type: "meeting",
        status: "scheduled",
        participants: 1,
        isRecurring: false,
        description: "",
      },
    });
    setIsCreateModalOpen(true);
  };

  const CreateMeetingModal = ({ isOpen, onClose, event }) => {
    const [formData, setFormData] = useState({
      title: event?.title || "",
      description: event?.resource?.description || "",
      start: event?.start || new Date(),
      end: event?.end || new Date(),
      maxParticipants: event?.resource?.participants || 10,
      isRecurring: event?.resource?.isRecurring || false,
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      // Here you would make an API call to create the meeting
      console.log("Creating meeting:", formData);
      onClose();
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Meeting</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start">Start Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={format(formData.start, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start: new Date(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={format(formData.end, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      end: new Date(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Select
                value={formData.maxParticipants.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, maxParticipants: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 people</SelectItem>
                  <SelectItem value="10">10 people</SelectItem>
                  <SelectItem value="25">25 people</SelectItem>
                  <SelectItem value="50">50 people</SelectItem>
                  <SelectItem value="100">100 people</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <FiPlus className="w-4 h-4 mr-2" />
                Create Meeting
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  const EventDetailsModal = ({ isOpen, onClose, event }) => {
    if (!event) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{event.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-4 h-4 text-muted" />
              <span>{format(event.start, "PPP")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <FiClock className="w-4 h-4 text-muted" />
              <span>
                {format(event.start, "p")} - {format(event.end, "p")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <FiUsers className="w-4 h-4 text-muted" />
              <span>{event.resource?.participants} participants</span>
            </div>
            {event.resource?.description && (
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted">
                  {event.resource.description}
                </p>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Badge
                variant={
                  event.resource?.status === "scheduled"
                    ? "default"
                    : event.resource?.status === "completed"
                      ? "success"
                      : "destructive"
                }
              >
                {event.resource?.status}
              </Badge>
              {event.resource?.isRecurring && (
                <Badge variant="outline">Recurring</Badge>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm">
                <FiEdit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button size="sm">
                <FiVideo className="w-4 h-4 mr-2" />
                Join Meeting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const CalendarToolbar = ({ label, onView, onNavigate, views }) => {
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => onNavigate("PREV")}
            size="sm"
          >
            ←
          </Button>
          <h2 className="text-lg font-semibold">{label}</h2>
          <Button
            variant="outline"
            onClick={() => onNavigate("NEXT")}
            size="sm"
          >
            →
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate("TODAY")}
            size="sm"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {views.map((viewName) => (
            <Button
              key={viewName}
              variant={view === viewName ? "default" : "outline"}
              size="sm"
              onClick={() => onView(viewName)}
              className="capitalize"
            >
              {viewName}
            </Button>
          ))}
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <FiPlus className="w-4 h-4 mr-2" />
            New Meeting
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Calendar"
        subtitle="Schedule and manage your meetings"
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted">Loading calendar...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Calendar"
      subtitle="Schedule and manage your meetings"
    >
      <Card>
        <CardContent className="p-6">
          <div style={{ height: "600px" }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              eventPropGetter={eventStyleGetter}
              views={["month", "week", "day", "agenda"]}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              components={{
                toolbar: CalendarToolbar,
              }}
              formats={{
                eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                  `${localizer.format(start, "h:mm a", culture)} - ${localizer.format(end, "h:mm a", culture)}`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <CreateMeetingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        event={selectedEvent}
      />

      <EventDetailsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        event={selectedEvent}
      />
    </DashboardLayout>
  );
};

export default CalendarPage;
