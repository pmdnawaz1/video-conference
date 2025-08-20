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
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  FiUserPlus,
  FiMail,
  FiUsers,
  FiLink,
  FiCopy,
  FiCalendar,
  FiClock,
  FiEye,
  FiTrash2,
  FiRefreshCw,
} from "react-icons/fi";
import { FaCheckCircle } from "react-icons/fa";
import useAuthStore from "../stores/authStore";

const InvitePage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("single");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState([]);

  // Single invitation form
  const [singleForm, setSingleForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "USER",
    message: "",
    expiresIn: "7", // days
  });

  // Bulk invitation form
  const [bulkForm, setBulkForm] = useState({
    emails: "",
    role: "USER",
    message: "",
    expiresIn: "7",
  });

  // Meeting invitation form
  const [meetingForm, setMeetingForm] = useState({
    meetingId: "",
    emails: "",
    message: "",
    sendCalendarInvite: true,
  });

  // Sample invitations data
  useEffect(() => {
    const sampleInvitations = [
      {
        id: "1",
        email: "john.doe@example.com",
        name: "John Doe",
        role: "USER",
        status: "pending",
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        type: "user",
      },
      {
        id: "2",
        email: "jane.smith@example.com",
        name: "Jane Smith",
        role: "USER",
        status: "accepted",
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        type: "user",
      },
      {
        id: "3",
        email: "meeting@example.com",
        name: "Team Meeting Invite",
        status: "pending",
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        meetingTitle: "Weekly Standup",
        meetingTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type: "meeting",
      },
    ];
    setInvitations(sampleInvitations);
  }, []);

  const handleSingleInvite = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // API call to send single invitation
      console.log("Sending single invitation:", singleForm);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset form
      setSingleForm({
        email: "",
        firstName: "",
        lastName: "",
        role: "USER",
        message: "",
        expiresIn: "7",
      });

      // Show success message
      alert("Invitation sent successfully!");
    } catch (error) {
      console.error("Error sending invitation:", error);
      alert("Failed to send invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkInvite = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emails = bulkForm.emails
        .split("\n")
        .filter((email) => email.trim());
      console.log("Sending bulk invitations to:", emails);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reset form
      setBulkForm({
        emails: "",
        role: "USER",
        message: "",
        expiresIn: "7",
      });

      alert(`${emails.length} invitations sent successfully!`);
    } catch (error) {
      console.error("Error sending bulk invitations:", error);
      alert("Failed to send invitations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingInvite = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emails = meetingForm.emails
        .split("\n")
        .filter((email) => email.trim());
      console.log("Sending meeting invitations:", { ...meetingForm, emails });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset form
      setMeetingForm({
        meetingId: "",
        emails: "",
        message: "",
        sendCalendarInvite: true,
      });

      alert(`Meeting invitations sent to ${emails.length} recipients!`);
    } catch (error) {
      console.error("Error sending meeting invitations:", error);
      alert("Failed to send meeting invitations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = (invitationId) => {
    const link = `${window.location.origin}/user-invitation/${invitationId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resendInvitation = (invitationId) => {
    console.log("Resending invitation:", invitationId);
    // API call to resend invitation
  };

  const cancelInvitation = (invitationId) => {
    if (confirm("Are you sure you want to cancel this invitation?")) {
      console.log("Canceling invitation:", invitationId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "badge-warning";
      case "accepted":
        return "badge-success";
      case "expired":
        return "badge-destructive";
      case "cancelled":
        return "badge-gray";
      default:
        return "badge-gray";
    }
  };

  const SingleInviteForm = () => (
    <form onSubmit={handleSingleInvite} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={singleForm.firstName}
            onChange={(e) =>
              setSingleForm({ ...singleForm, firstName: e.target.value })
            }
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={singleForm.lastName}
            onChange={(e) =>
              setSingleForm({ ...singleForm, lastName: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={singleForm.email}
          onChange={(e) =>
            setSingleForm({ ...singleForm, email: e.target.value })
          }
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role</Label>
          <Select
            value={singleForm.role}
            onValueChange={(value) =>
              setSingleForm({ ...singleForm, role: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="expiresIn">Expires In</Label>
          <Select
            value={singleForm.expiresIn}
            onValueChange={(value) =>
              setSingleForm({ ...singleForm, expiresIn: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="message">Personal Message (Optional)</Label>
        <Textarea
          id="message"
          value={singleForm.message}
          onChange={(e) =>
            setSingleForm({ ...singleForm, message: e.target.value })
          }
          placeholder="Add a personal message to the invitation..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Sending...
          </>
        ) : (
          <>
            <FiMail className="w-4 h-4 mr-2" />
            Send Invitation
          </>
        )}
      </Button>
    </form>
  );

  const BulkInviteForm = () => (
    <form onSubmit={handleBulkInvite} className="space-y-4">
      <div>
        <Label htmlFor="emails">Email Addresses</Label>
        <Textarea
          id="emails"
          value={bulkForm.emails}
          onChange={(e) => setBulkForm({ ...bulkForm, emails: e.target.value })}
          placeholder="Enter email addresses, one per line:&#10;john@example.com&#10;jane@example.com&#10;..."
          rows={6}
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Enter one email address per line
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bulkRole">Role</Label>
          <Select
            value={bulkForm.role}
            onValueChange={(value) => setBulkForm({ ...bulkForm, role: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bulkExpiresIn">Expires In</Label>
          <Select
            value={bulkForm.expiresIn}
            onValueChange={(value) =>
              setBulkForm({ ...bulkForm, expiresIn: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="bulkMessage">Personal Message (Optional)</Label>
        <Textarea
          id="bulkMessage"
          value={bulkForm.message}
          onChange={(e) =>
            setBulkForm({ ...bulkForm, message: e.target.value })
          }
          placeholder="Add a personal message to all invitations..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Sending...
          </>
        ) : (
          <>
            <FiUsers className="w-4 h-4 mr-2" />
            Send Bulk Invitations
          </>
        )}
      </Button>
    </form>
  );

  return (
    <DashboardLayout
      title="Invite Users"
      subtitle="Send invitations to join your organization"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invitation Forms */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiUserPlus className="w-5 h-5 mr-2" />
                Send Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="single">Single User</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
                  <TabsTrigger value="meeting">Meeting</TabsTrigger>
                </TabsList>

                <TabsContent value="single">
                  <SingleInviteForm />
                </TabsContent>

                <TabsContent value="bulk">
                  <BulkInviteForm />
                </TabsContent>

                <TabsContent value="meeting">
                  <form onSubmit={handleMeetingInvite} className="space-y-4">
                    <div>
                      <Label htmlFor="meetingId">Meeting</Label>
                      <Select
                        value={meetingForm.meetingId}
                        onValueChange={(value) =>
                          setMeetingForm({ ...meetingForm, meetingId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a meeting" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting-1">
                            Weekly Standup
                          </SelectItem>
                          <SelectItem value="meeting-2">
                            Client Review
                          </SelectItem>
                          <SelectItem value="meeting-3">All Hands</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="meetingEmails">Invite Participants</Label>
                      <Textarea
                        id="meetingEmails"
                        value={meetingForm.emails}
                        onChange={(e) =>
                          setMeetingForm({
                            ...meetingForm,
                            emails: e.target.value,
                          })
                        }
                        placeholder="Enter email addresses, one per line..."
                        rows={4}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="meetingMessage">Message (Optional)</Label>
                      <Textarea
                        id="meetingMessage"
                        value={meetingForm.message}
                        onChange={(e) =>
                          setMeetingForm({
                            ...meetingForm,
                            message: e.target.value,
                          })
                        }
                        placeholder="Add a message to the meeting invitation..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="calendarInvite"
                        checked={meetingForm.sendCalendarInvite}
                        onChange={(e) =>
                          setMeetingForm({
                            ...meetingForm,
                            sendCalendarInvite: e.target.checked,
                          })
                        }
                      />
                      <Label htmlFor="calendarInvite" className="text-sm">
                        Send calendar invite
                      </Label>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <FiCalendar className="w-4 h-4 mr-2" />
                          Send Meeting Invites
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invitations */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiClock className="w-5 h-5 mr-2" />
                Recent Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">
                          {invitation.name || invitation.email}
                        </p>
                        {invitation.type === "meeting" && (
                          <p className="text-xs text-muted-foreground">
                            {invitation.meetingTitle}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`text-xs ${getStatusColor(invitation.status)}`}
                      >
                        {invitation.status}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        {invitation.sentAt.toLocaleDateString()}
                      </p>

                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.id)}
                          title="Copy invite link"
                        >
                          {copied ? (
                            <FaCheckCircle className="w-3 h-3" />
                          ) : (
                            <FiCopy className="w-3 h-3" />
                          )}
                        </Button>

                        {invitation.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendInvitation(invitation.id)}
                              title="Resend"
                            >
                              <FiRefreshCw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelInvitation(invitation.id)}
                              title="Cancel"
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InvitePage;
