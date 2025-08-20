import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  FiFilter,
  FiX,
  FiCalendar,
  FiClock,
  FiUsers,
  FiVideo,
  FiSearch,
} from "react-icons/fi";
import { format } from "date-fns";

const MeetingHistoryFilter = ({ filters = {}, onFiltersChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    search: "",
    dateRange: { from: null, to: null },
    status: "",
    duration: "",
    participants: "",
    sortBy: "date_desc",
    ...filters,
  });

  const [activeFilterCount, setActiveFilterCount] = useState(0);

  useEffect(() => {
    // Count active filters
    const count = Object.entries(localFilters).reduce((acc, [key, value]) => {
      if (key === "sortBy") return acc; // Don't count sort as an active filter
      if (key === "dateRange" && (!value.from || !value.to)) return acc;
      if (value && value !== "") return acc + 1;
      return acc;
    }, 0);
    setActiveFilterCount(count);
  }, [localFilters]);

  const handleFilterChange = (key, value) => {
    const newFilters = {
      ...localFilters,
      [key]: value,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilter = (key) => {
    let clearedValue;
    if (key === "dateRange") {
      clearedValue = { from: null, to: null };
    } else {
      clearedValue = "";
    }
    handleFilterChange(key, clearedValue);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      search: "",
      dateRange: { from: null, to: null },
      status: "",
      duration: "",
      participants: "",
      sortBy: localFilters.sortBy, // Keep sort order
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const durationOptions = [
    { value: "", label: "Any Duration" },
    { value: "0-15", label: "0-15 minutes" },
    { value: "15-30", label: "15-30 minutes" },
    { value: "30-60", label: "30-60 minutes" },
    { value: "60-120", label: "1-2 hours" },
    { value: "120+", label: "2+ hours" },
  ];

  const participantOptions = [
    { value: "", label: "Any Size" },
    { value: "1-5", label: "1-5 participants" },
    { value: "6-10", label: "6-10 participants" },
    { value: "11-20", label: "11-20 participants" },
    { value: "21-50", label: "21-50 participants" },
    { value: "50+", label: "50+ participants" },
  ];

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No Show" },
  ];

  const sortOptions = [
    { value: "date_desc", label: "Most Recent" },
    { value: "date_asc", label: "Oldest First" },
    { value: "duration_desc", label: "Longest First" },
    { value: "duration_asc", label: "Shortest First" },
    { value: "participants_desc", label: "Most Participants" },
    { value: "title_asc", label: "Title A-Z" },
  ];

  return (
    <div className="space-y-4">
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search meetings..."
            value={localFilters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-10"
            aria-label="Search meetings"
          />
          {localFilters.search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearFilter("search")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              aria-label="Clear search"
            >
              <FiX className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button
            variant={isExpanded ? "default" : "outline"}
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label="Toggle advanced filters"
          >
            <FiFilter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2 px-1.5 py-0.5 text-xs min-w-[1.25rem] h-5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {/* Sort */}
          <Select
            value={localFilters.sortBy}
            onValueChange={(value) => handleFilterChange("sortBy", value)}
          >
            <SelectTrigger className="w-[140px]" aria-label="Sort meetings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>

          {localFilters.search && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <FiSearch className="w-3 h-3" />
              Search: "{localFilters.search}"
              <button
                onClick={() => clearFilter("search")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label="Remove search filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {localFilters.dateRange.from && localFilters.dateRange.to && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              {format(localFilters.dateRange.from, "MMM dd")} -{" "}
              {format(localFilters.dateRange.to, "MMM dd")}
              <button
                onClick={() => clearFilter("dateRange")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label="Remove date range filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {localFilters.status && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status:{" "}
              {
                statusOptions.find((s) => s.value === localFilters.status)
                  ?.label
              }
              <button
                onClick={() => clearFilter("status")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label="Remove status filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {localFilters.duration && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <FiClock className="w-3 h-3" />
              {
                durationOptions.find((d) => d.value === localFilters.duration)
                  ?.label
              }
              <button
                onClick={() => clearFilter("duration")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label="Remove duration filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {localFilters.participants && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <FiUsers className="w-3 h-3" />
              {
                participantOptions.find(
                  (p) => p.value === localFilters.participants,
                )?.label
              }
              <button
                onClick={() => clearFilter("participants")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label="Remove participants filter"
              >
                <FiX className="w-3 h-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    aria-label="Select date range"
                  >
                    <FiCalendar className="mr-2 h-4 w-4" />
                    {localFilters.dateRange.from ? (
                      localFilters.dateRange.to ? (
                        <>
                          {format(localFilters.dateRange.from, "LLL dd, y")} -{" "}
                          {format(localFilters.dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(localFilters.dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={localFilters.dateRange.from}
                    selected={localFilters.dateRange}
                    onSelect={(dateRange) =>
                      handleFilterChange(
                        "dateRange",
                        dateRange || { from: null, to: null },
                      )
                    }
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={localFilters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration</label>
              <Select
                value={localFilters.duration}
                onValueChange={(value) => handleFilterChange("duration", value)}
              >
                <SelectTrigger aria-label="Filter by duration">
                  <SelectValue placeholder="Any Duration" />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Participants</label>
              <Select
                value={localFilters.participants}
                onValueChange={(value) =>
                  handleFilterChange("participants", value)
                }
              >
                <SelectTrigger aria-label="Filter by participant count">
                  <SelectValue placeholder="Any Size" />
                </SelectTrigger>
                <SelectContent>
                  {participantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
            <Button size="sm" onClick={() => setIsExpanded(false)}>
              Apply Filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MeetingHistoryFilter;
