import React, { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar } from "../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  FiUsers,
  FiPlus,
  FiSearch,
  FiMoreVertical,
  FiCalendar,
  FiSettings,
  FiEye,
  FiUserPlus,
  FiLogOut,
  FiShield,
  FiFilter,
  FiGrid,
  FiList,
} from "react-icons/fi";
import { TfiCrown } from "react-icons/tfi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import useAuthStore from "../stores/authStore";

const GroupsPage = () => {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("my-groups");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sample groups data - replace with actual API calls
  useEffect(() => {
    const sampleGroups = [
      {
        id: "1",
        name: "Engineering Team",
        description: "Software development and engineering discussions",
        memberCount: 12,
        isPublic: false,
        role: "admin",
        avatar: null,
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        upcomingMeetings: 2,
        recentMessages: 5,
        members: [
          {
            id: "1",
            name: "John Doe",
            email: "john@example.com",
            role: "member",
            avatar: null,
          },
          {
            id: "2",
            name: "Jane Smith",
            email: "jane@example.com",
            role: "admin",
            avatar: null,
          },
          // ... more members
        ],
        settings: {
          allowInvites: true,
          requireApproval: false,
          enableMeetingRecording: true,
        },
      },
      {
        id: "2",
        name: "Design Team",
        description: "UI/UX design collaboration and feedback",
        memberCount: 8,
        isPublic: true,
        role: "member",
        avatar: null,
        lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        upcomingMeetings: 1,
        recentMessages: 12,
        members: [
          {
            id: "3",
            name: "Alice Johnson",
            email: "alice@example.com",
            role: "admin",
            avatar: null,
          },
          {
            id: "4",
            name: "Bob Wilson",
            email: "bob@example.com",
            role: "member",
            avatar: null,
          },
        ],
        settings: {
          allowInvites: false,
          requireApproval: true,
          enableMeetingRecording: false,
        },
      },
      {
        id: "3",
        name: "All Hands",
        description: "Company-wide announcements and meetings",
        memberCount: 45,
        isPublic: true,
        role: "member",
        avatar: null,
        lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        upcomingMeetings: 0,
        recentMessages: 3,
        members: [],
        settings: {
          allowInvites: false,
          requireApproval: false,
          enableMeetingRecording: true,
        },
      },
    ];

    setTimeout(() => {
      setGroups(sampleGroups);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return <TfiCrown className="w-3 h-3 text-yellow-500" />;
      case "moderator":
        return <FiShield className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getLastActivityText = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "Active now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const GroupCard = ({ group }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <FiUsers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center">
                {group.name}
                {getRoleIcon(group.role)}
                {!group.isPublic && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Private
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {group.memberCount} members
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <FiMoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedGroup(group)}>
                <FiEye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {group.role === "admin" && (
                <DropdownMenuItem>
                  <FiSettings className="w-4 h-4 mr-2" />
                  Manage Group
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <FiUserPlus className="w-4 h-4 mr-2" />
                Invite Members
              </DropdownMenuItem>
              {group.role !== "admin" && (
                <DropdownMenuItem className="text-red-600">
                  <FiLogOut className="w-4 h-4 mr-2" />
                  Leave Group
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {group.description}
        </p>

        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-muted-foreground">
              <FiCalendar className="w-3 h-3 mr-1" />
              {group.upcomingMeetings} meetings
            </span>
            <span className="text-muted-foreground">
              {group.recentMessages} new messages
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {getLastActivityText(group.lastActivity)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const GroupListItem = ({ group }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <FiUsers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium flex items-center">
                {group.name}
                {getRoleIcon(group.role)}
                {!group.isPublic && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Private
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {group.description}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>{group.memberCount} members</span>
            <span>{group.upcomingMeetings} meetings</span>
            <span>{getLastActivityText(group.lastActivity)}</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <FiMoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedGroup(group)}>
                  <FiEye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {group.role === "admin" && (
                  <DropdownMenuItem>
                    <FiSettings className="w-4 h-4 mr-2" />
                    Manage Group
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <FiUserPlus className="w-4 h-4 mr-2" />
                  Invite Members
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const GroupDetailsModal = ({ group, isOpen, onClose }) => {
    if (!group) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FiUsers className="w-5 h-5 mr-2" />
              {group.name}
              {getRoleIcon(group.role)}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">
                Members ({group.memberCount})
              </TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Group Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Members:</span>
                      <span>{group.memberCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span>{group.isPublic ? "Public" : "Private"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Role:</span>
                      <span className="capitalize">{group.role}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Activity</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Last Activity:</span>
                      <span>{getLastActivityText(group.lastActivity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Upcoming Meetings:</span>
                      <span>{group.upcomingMeetings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New Messages:</span>
                      <span>{group.recentMessages}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <div className="space-y-3">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted0 rounded-full flex items-center justify-center">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize">
                        {member.role}
                      </Badge>
                      {getRoleIcon(member.role)}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="meetings" className="space-y-4">
              <div className="text-center py-8">
                <FiCalendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No upcoming meetings</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button>
              <FiCalendar className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <DashboardLayout
        title="My Groups"
        subtitle="Manage your group memberships"
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading groups...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Groups" subtitle="Manage your group memberships">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <FiGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <FiList className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <FiFilter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button>
            <FiPlus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Groups Display */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FiUsers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No groups found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? "No groups match your search."
                : "You haven't joined any groups yet."}
            </p>
            <Button>
              <FiPlus className="w-4 h-4 mr-2" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {filteredGroups.map((group) =>
            viewMode === "grid" ? (
              <GroupCard key={group.id} group={group} />
            ) : (
              <GroupListItem key={group.id} group={group} />
            ),
          )}
        </div>
      )}

      {/* Group Details Modal */}
      <GroupDetailsModal
        group={selectedGroup}
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
      />
    </DashboardLayout>
  );
};

export default GroupsPage;
