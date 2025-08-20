import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Slider } from "../ui/slider";
import { Progress } from "../ui/progress";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Download,
  Share2,
  Eye,
  EyeOff,
  Search,
  Filter,
  Clock,
  Calendar,
  Users,
  FileText,
  MessageSquare,
  Star,
  StarOff,
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Edit3,
  Copy,
  ExternalLink,
  Settings,
  Zap,
  Activity,
  Target,
  Video,
  Mic,
  Camera,
  Monitor,
} from "lucide-react";
import useUserStore from "../../stores/userStore";
import userAnalyticsService from "../../services/UserAnalyticsService";
import LoadingSpinner from "../ui/LoadingSpinner";

const RecordingsManager = () => {
  const {
    savedRecordings,
    bookmarkedMoments,
    sharedResources,
    bookmarkMoment,
    removeBookmark,
  } = useUserStore();

  const [selectedRecording, setSelectedRecording] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    userAnalyticsService.trackEvent("recordings_page_viewed", {
      total_recordings: savedRecordings?.length || 0,
      timestamp: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (selectedRecording && videoRef.current) {
      const video = videoRef.current;

      const updateProgress = () => {
        setCurrentTime(video.currentTime);
        setDuration(video.duration);
      };

      const handleLoadedMetadata = () => {
        setDuration(video.duration);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        userAnalyticsService.trackEvent("recording_completed", {
          recording_id: selectedRecording.id,
          duration_watched: video.currentTime,
          completion_rate: (video.currentTime / video.duration) * 100,
          timestamp: Date.now(),
        });
      };

      video.addEventListener("timeupdate", updateProgress);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);

      return () => {
        video.removeEventListener("timeupdate", updateProgress);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("ended", handleEnded);
      };
    }
  }, [selectedRecording]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);

      userAnalyticsService.trackEvent("recording_played", {
        recording_id: selectedRecording?.id,
        timestamp: Date.now(),
      });
    }
  };

  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const handlePlaybackRateChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleBookmarkAdd = async () => {
    if (!selectedRecording || !videoRef.current) return;

    const timestamp = Math.floor(videoRef.current.currentTime);
    const result = await bookmarkMoment(
      selectedRecording.meeting_id,
      timestamp,
      bookmarkNote,
    );

    if (result.success) {
      setBookmarks([...bookmarks, result.bookmark]);
      setShowBookmarkDialog(false);
      setBookmarkNote("");

      userAnalyticsService.trackEvent("recording_bookmarked", {
        recording_id: selectedRecording.id,
        timestamp: timestamp,
        timestamp: Date.now(),
      });
    }
  };

  const handleDownload = async (recording) => {
    // Simulate download
    const link = document.createElement("a");
    link.href = recording.download_url;
    link.download = `${recording.title}_${recording.date}.mp4`;
    link.click();

    userAnalyticsService.trackEvent("recording_downloaded", {
      recording_id: recording.id,
      file_size: recording.file_size,
      timestamp: Date.now(),
    });
  };

  const handleShare = async (recording) => {
    if (navigator.share) {
      await navigator.share({
        title: recording.title,
        text: `Watch this meeting recording: ${recording.title}`,
        url: recording.share_url,
      });
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(recording.share_url);
    }

    userAnalyticsService.trackEvent("recording_shared", {
      recording_id: recording.id,
      share_method: navigator.share ? "native" : "clipboard",
      timestamp: Date.now(),
    });
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredRecordings =
    savedRecordings?.filter((recording) => {
      const matchesSearch =
        !searchTerm ||
        recording.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recording.organizer?.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterType === "all" ||
        (filterType === "starred" && recording.is_starred) ||
        (filterType === "recent" &&
          new Date(recording.date) >
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      return matchesSearch && matchesFilter;
    }) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6" />
            Recordings & Resources
          </h1>
          <p className="text-muted-foreground">
            Access your meeting recordings, transcripts, and shared files
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Recordings List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recordings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Filter</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Recordings</SelectItem>
                    <SelectItem value="starred">Starred</SelectItem>
                    <SelectItem value="recent">Recent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest First</SelectItem>
                    <SelectItem value="date_asc">Oldest First</SelectItem>
                    <SelectItem value="duration_desc">Longest First</SelectItem>
                    <SelectItem value="title_asc">Title A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Recordings List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recordings ({filteredRecordings.length})</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={filteredRecordings.length < 10}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : filteredRecordings.length > 0 ? (
                  <div className="space-y-2">
                    {filteredRecordings
                      .slice((currentPage - 1) * 10, currentPage * 10)
                      .map((recording) => (
                        <Card
                          key={recording.id}
                          className={`cursor-pointer transition-colors ${
                            selectedRecording?.id === recording.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                              : "hover:bg-muted dark:hover:bg-muted0"
                          }`}
                          onClick={() => setSelectedRecording(recording)}
                        >
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {recording.title}
                                </h4>
                                <div className="flex items-center gap-1">
                                  {recording.is_starred && (
                                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(recording.date)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(recording.duration)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {formatFileSize(recording.file_size)}
                                </Badge>
                                {recording.has_transcript && (
                                  <Badge variant="outline" className="text-xs">
                                    <MessageSquare className="w-2 h-2 mr-1" />
                                    Transcript
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No recordings found</p>
                    <p className="text-sm">
                      Your meeting recordings will appear here
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedRecording ? (
            <>
              {/* Video Player */}
              <Card>
                <CardContent className="p-0">
                  <div className="relative bg-black rounded-t-lg">
                    <video
                      ref={videoRef}
                      src={selectedRecording.video_url}
                      className="w-full h-64 lg:h-96 object-contain rounded-t-lg"
                      poster={selectedRecording.thumbnail_url}
                    />

                    {/* Video Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <div className="space-y-3">
                        {/* Progress Bar */}
                        <div className="relative">
                          <div
                            ref={progressRef}
                            className="w-full h-2 bg-white/20 rounded-full cursor-pointer"
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const percent =
                                (e.clientX - rect.left) / rect.width;
                              handleSeek(percent * duration);
                            }}
                          >
                            <div
                              className="h-full bg-blue-500 rounded-full relative"
                              style={{
                                width: `${(currentTime / duration) * 100 || 0}%`,
                              }}
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"></div>
                            </div>

                            {/* Bookmark indicators */}
                            {bookmarks.map((bookmark, index) => (
                              <div
                                key={index}
                                className="absolute top-0 w-1 h-full bg-yellow-500 rounded-full"
                                style={{
                                  left: `${(bookmark.timestamp / duration) * 100}%`,
                                }}
                                title={bookmark.note}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handlePlayPause}
                              className="text-white hover:bg-white/20"
                            >
                              {isPlaying ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSeek(Math.max(0, currentTime - 10))
                              }
                              className="text-white hover:bg-white/20"
                            >
                              <Rewind className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSeek(Math.min(duration, currentTime + 10))
                              }
                              className="text-white hover:bg-white/20"
                            >
                              <FastForward className="w-4 h-4" />
                            </Button>

                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMuteToggle}
                                className="text-white hover:bg-white/20"
                              >
                                {isMuted ? (
                                  <VolumeX className="w-4 h-4" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                              </Button>

                              <div className="w-20">
                                <Slider
                                  value={[isMuted ? 0 : volume]}
                                  onValueChange={([value]) =>
                                    handleVolumeChange(value)
                                  }
                                  max={1}
                                  step={0.1}
                                  className="text-white"
                                />
                              </div>
                            </div>

                            <span className="text-white text-sm">
                              {formatDuration(currentTime)} /{" "}
                              {formatDuration(duration)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Select
                              value={playbackRate.toString()}
                              onValueChange={(value) =>
                                handlePlaybackRateChange(parseFloat(value))
                              }
                            >
                              <SelectTrigger className="w-20 bg-white/20 text-white border-white/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.5">0.5x</SelectItem>
                                <SelectItem value="0.75">0.75x</SelectItem>
                                <SelectItem value="1">1x</SelectItem>
                                <SelectItem value="1.25">1.25x</SelectItem>
                                <SelectItem value="1.5">1.5x</SelectItem>
                                <SelectItem value="2">2x</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowBookmarkDialog(true)}
                              className="text-white hover:bg-white/20"
                            >
                              <Bookmark className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleFullscreenToggle}
                              className="text-white hover:bg-white/20"
                            >
                              <Maximize className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recording Info */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">
                          {selectedRecording.title}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(selectedRecording.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(selectedRecording.duration)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {selectedRecording.participants_count} participants
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Toggle starred status
                            selectedRecording.is_starred =
                              !selectedRecording.is_starred;
                            setSelectedRecording({ ...selectedRecording });
                          }}
                        >
                          {selectedRecording.is_starred ? (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShare(selectedRecording)}
                        >
                          <Share2 className="w-4 h-4 mr-1" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(selectedRecording)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>

                    {selectedRecording.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {selectedRecording.description}
                      </p>
                    )}

                    {/* Tabs for additional content */}
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList>
                        <TabsTrigger value="info">Info</TabsTrigger>
                        {selectedRecording.has_transcript && (
                          <TabsTrigger value="transcript">
                            Transcript
                          </TabsTrigger>
                        )}
                        {selectedRecording.chat_messages && (
                          <TabsTrigger value="chat">Chat</TabsTrigger>
                        )}
                        <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
                        {selectedRecording.shared_files?.length > 0 && (
                          <TabsTrigger value="files">Files</TabsTrigger>
                        )}
                      </TabsList>

                      <TabsContent value="info" className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm font-medium">Organizer</div>
                            <div className="text-sm text-muted-foreground">
                              {selectedRecording.organizer?.name}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">File Size</div>
                            <div className="text-sm text-muted-foreground">
                              {formatFileSize(selectedRecording.file_size)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">Quality</div>
                            <div className="text-sm text-muted-foreground">
                              {selectedRecording.quality || "HD"}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">Format</div>
                            <div className="text-sm text-muted-foreground">
                              {selectedRecording.format || "MP4"}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {selectedRecording.has_transcript && (
                        <TabsContent value="transcript">
                          <ScrollArea className="h-64 border rounded p-4">
                            <div className="space-y-2 text-sm">
                              {selectedRecording.transcript?.map(
                                (entry, index) => (
                                  <div key={index} className="flex gap-3">
                                    <span className="text-muted-foreground min-w-16">
                                      {formatDuration(entry.timestamp)}
                                    </span>
                                    <span className="font-medium min-w-24">
                                      {entry.speaker}:
                                    </span>
                                    <span>{entry.text}</span>
                                  </div>
                                ),
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      )}

                      {selectedRecording.chat_messages && (
                        <TabsContent value="chat">
                          <ScrollArea className="h-64 border rounded p-4">
                            <div className="space-y-3">
                              {selectedRecording.chat_messages.map(
                                (message, index) => (
                                  <div key={index} className="flex gap-3">
                                    <span className="text-muted-foreground text-xs min-w-16">
                                      {formatDuration(message.timestamp)}
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                          {message.sender}
                                        </span>
                                      </div>
                                      <p className="text-sm">
                                        {message.message}
                                      </p>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      )}

                      <TabsContent value="bookmarks">
                        <div className="space-y-2">
                          {bookmarks.length > 0 ? (
                            bookmarks.map((bookmark, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 border rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleSeek(bookmark.timestamp)
                                    }
                                  >
                                    <Play className="w-4 h-4" />
                                  </Button>
                                  <div>
                                    <div className="font-medium text-sm">
                                      {formatDuration(bookmark.timestamp)}
                                    </div>
                                    {bookmark.note && (
                                      <div className="text-xs text-muted-foreground">
                                        {bookmark.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBookmark(bookmark.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>No bookmarks yet</p>
                              <p className="text-sm">
                                Click the bookmark button to save moments
                              </p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {selectedRecording.shared_files?.length > 0 && (
                        <TabsContent value="files">
                          <div className="space-y-2">
                            {selectedRecording.shared_files.map(
                              (file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 border rounded"
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-8 h-8 text-blue-500" />
                                    <div>
                                      <div className="font-medium text-sm">
                                        {file.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatFileSize(file.size)} • Shared by{" "}
                                        {file.shared_by}
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              ),
                            )}
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">
                    Select a Recording
                  </h3>
                  <p className="text-muted-foreground">
                    Choose a recording from the list to start viewing
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bookmark Dialog */}
      <Dialog open={showBookmarkDialog} onOpenChange={setShowBookmarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bookmark</DialogTitle>
            <DialogDescription>
              Save this moment at {formatDuration(currentTime)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bookmark-note">Note (optional)</Label>
              <Input
                id="bookmark-note"
                placeholder="Add a note about this moment..."
                value={bookmarkNote}
                onChange={(e) => setBookmarkNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBookmarkDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleBookmarkAdd}>
                <BookmarkCheck className="w-4 h-4 mr-1" />
                Save Bookmark
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecordingsManager;
