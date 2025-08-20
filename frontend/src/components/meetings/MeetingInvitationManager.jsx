import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import useAuthStore from "../../stores/authStore";
import { useRoleCheck } from "../auth/RoleBasedAccess";

const MeetingInvitationManager = ({ meeting, onClose, onInvitationsSent }) => {
  const [activeTab, setActiveTab] = useState("single");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitationHistory, setInvitationHistory] = useState([]);

  const { accessToken } = useAuthStore();
  const { hasRole, canInviteUsers } = useRoleCheck();

  useEffect(() => {
    if (canInviteUsers) {
      loadGroups();
      loadInvitationHistory();
    }
  }, [canInviteUsers]);

  const apiCall = async (endpoint, options = {}) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}${endpoint}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
        ...options,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const loadGroups = async () => {
    if (!hasRole("ADMIN")) return; // Only admins can see groups

    try {
      const result = await apiCall("/api/groups");
      if (result.success) {
        setGroups(result.groups);
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const loadInvitationHistory = async () => {
    try {
      const result = await apiCall(
        `/api/invitations?meetingId=${meeting.id}&limit=10`,
      );
      if (result.success) {
        setInvitationHistory(result.invitations);
      }
    } catch (error) {
      console.error("Failed to load invitation history:", error);
    }
  };

  const sendSingleInvitation = async () => {
    if (!singleEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiCall("/api/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: singleEmail.trim(),
          invitationType: "USER",
          meetingId: meeting.id,
          meetingRole: "participant",
          customMessage: customMessage.trim() || undefined,
        }),
      });

      if (result.success) {
        setSingleEmail("");
        setCustomMessage("");
        loadInvitationHistory();
        onInvitationsSent && onInvitationsSent(1);
        alert("Invitation sent successfully!");
      }
    } catch (error) {
      alert(`Failed to send invitation: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendGroupInvitation = async () => {
    if (!selectedGroup) {
      alert("Please select a group");
      return;
    }

    setIsLoading(true);
    try {
      // First get group members
      const groupResult = await apiCall(`/api/groups/${selectedGroup}/members`);
      if (!groupResult.success) {
        throw new Error("Failed to get group members");
      }

      const members = groupResult.members;
      if (members.length === 0) {
        alert("Selected group has no members");
        return;
      }

      // Send bulk invitations to all group members
      const invitations = members.map((member) => ({
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
      }));

      const result = await apiCall("/api/invitations/bulk", {
        method: "POST",
        body: JSON.stringify({
          invitations,
          invitationType: "BULK",
          meetingId: meeting.id,
          customMessage: customMessage.trim() || undefined,
        }),
      });

      if (result.success) {
        setSelectedGroup("");
        setCustomMessage("");
        loadInvitationHistory();
        onInvitationsSent && onInvitationsSent(result.result.created);
        alert(
          `${result.result.created} invitations sent successfully! ${result.result.failed} failed.`,
        );
      }
    } catch (error) {
      alert(`Failed to send group invitations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendBulkInvitations = async () => {
    if (!bulkEmails.trim()) {
      alert("Please enter email addresses");
      return;
    }

    const emails = bulkEmails
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (emails.length === 0) {
      alert("No valid email addresses found");
      return;
    }

    if (emails.length > 50) {
      alert("Maximum 50 invitations allowed at once");
      return;
    }

    setIsLoading(true);
    try {
      const invitations = emails.map((email) => ({
        email,
        firstName: "",
        lastName: "",
      }));

      const result = await apiCall("/api/invitations/bulk", {
        method: "POST",
        body: JSON.stringify({
          invitations,
          invitationType: "BULK",
          meetingId: meeting.id,
          customMessage: customMessage.trim() || undefined,
        }),
      });

      if (result.success) {
        setBulkEmails("");
        setCustomMessage("");
        loadInvitationHistory();
        onInvitationsSent && onInvitationsSent(result.result.created);
        alert(
          `${result.result.created} invitations sent successfully! ${result.result.failed} failed.`,
        );
      }
    } catch (error) {
      alert(`Failed to send bulk invitations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!canInviteUsers) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>You don't have permission to invite users to meetings.</p>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Invite to Meeting</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {meeting.title}
              </p>
              <p className="text-xs text-muted-foreground">
                📅 {formatDate(meeting.scheduledStartTime || meeting.startTime)}
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single User</TabsTrigger>
              {hasRole("ADMIN") && (
                <TabsTrigger value="group">Group Invite</TabsTrigger>
              )}
              <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
            </TabsList>

            {/* Single User Invitation */}
            <TabsContent value="single" className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom Message (optional)
                </label>
                <Input
                  placeholder="Join us for an important meeting..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              <Button
                onClick={sendSingleInvitation}
                disabled={isLoading || !singleEmail.trim()}
                className="w-full"
              >
                {isLoading ? "Sending..." : "Send Invitation"}
              </Button>
            </TabsContent>

            {/* Group Invitation */}
            {hasRole("ADMIN") && (
              <TabsContent value="group" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Group
                  </label>
                  <Select
                    value={selectedGroup}
                    onValueChange={setSelectedGroup}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a group to invite" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.memberCount} members)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Custom Message (optional)
                  </label>
                  <Input
                    placeholder="Team meeting invitation..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                </div>

                <Button
                  onClick={sendGroupInvitation}
                  disabled={isLoading || !selectedGroup}
                  className="w-full"
                >
                  {isLoading ? "Sending..." : "Invite Entire Group"}
                </Button>
              </TabsContent>
            )}

            {/* Bulk Invitation */}
            <TabsContent value="bulk" className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Addresses (one per line or comma-separated)
                </label>
                <textarea
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum 50 invitations per batch
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom Message (optional)
                </label>
                <Input
                  placeholder="You're invited to join our meeting..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              <Button
                onClick={sendBulkInvitations}
                disabled={isLoading || !bulkEmails.trim()}
                className="w-full"
              >
                {isLoading ? "Sending..." : "Send Bulk Invitations"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invitation History */}
      {invitationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitationHistory.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <span className="font-medium">{invitation.email}</span>
                    {invitation.firstName && (
                      <span className="text-muted-foreground ml-2">
                        ({invitation.firstName} {invitation.lastName})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        invitation.status === "ACCEPTED"
                          ? "default"
                          : invitation.status === "PENDING"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {invitation.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(invitation.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeetingInvitationManager;
