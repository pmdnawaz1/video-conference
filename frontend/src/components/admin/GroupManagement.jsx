import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import useAuthStore from "../../stores/authStore";

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const { user, accessToken } = useAuthStore();

  // Check if user has admin permissions
  const hasAdminAccess = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (hasAdminAccess) {
      loadGroups();
    }
  }, [hasAdminAccess]);

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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const loadGroups = async () => {
    try {
      const result = await apiCall("/api/groups");
      if (result.success) {
        setGroups(result.groups);
        // Load members for each group
        for (const group of result.groups) {
          loadGroupMembers(group.id);
        }
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const result = await apiCall(`/api/groups/${groupId}/members`);
      if (result.success) {
        setMembers((prev) => ({
          ...prev,
          [groupId]: result.members,
        }));
      }
    } catch (error) {
      console.error(`Failed to load members for group ${groupId}:`, error);
    }
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) return;

    setIsCreating(true);
    try {
      const result = await apiCall("/api/groups", {
        method: "POST",
        body: JSON.stringify(newGroup),
      });

      if (result.success) {
        setGroups((prev) => [...prev, result.group]);
        setNewGroup({ name: "", description: "" });
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Failed to create group:", error);
      setIsCreating(false);
    }
  };

  const inviteToGroup = async (groupId) => {
    if (!newMemberEmail.trim()) return;

    try {
      const result = await apiCall("/api/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: newMemberEmail,
          invitationType: "GROUP",
          groupId: groupId,
          groupRole: "member",
        }),
      });

      if (result.success) {
        setNewMemberEmail("");
        // Reload group members
        loadGroupMembers(groupId);
        alert("Invitation sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send group invitation:", error);
    }
  };

  const removeMember = async (groupId, memberId) => {
    if (!confirm("Remove this member from the group?")) return;

    try {
      await apiCall(`/api/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
      });

      // Reload members
      loadGroupMembers(groupId);
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  if (!hasAdminAccess) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>Access denied. Admin permissions required.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Group Management</h2>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          variant={isCreating ? "outline" : "default"}
        >
          {isCreating ? "Cancel" : "Create Group"}
        </Button>
      </div>

      {/* Create Group Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Group Name"
              value={newGroup.name}
              onChange={(e) =>
                setNewGroup((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              placeholder="Description (optional)"
              value={newGroup.description}
              onChange={(e) =>
                setNewGroup((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
            <Button onClick={createGroup} disabled={!newGroup.name.trim()}>
              Create Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Groups List */}
      <div className="grid gap-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {group.name}
                    <Badge variant="secondary">
                      {members[group.id]?.length || 0} members
                    </Badge>
                  </CardTitle>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedGroup(
                      selectedGroup === group.id ? null : group.id,
                    )
                  }
                >
                  {selectedGroup === group.id ? "Hide" : "Manage"}
                </Button>
              </div>
            </CardHeader>

            {selectedGroup === group.id && (
              <CardContent className="space-y-4">
                {/* Invite New Member */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Email to invite"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => inviteToGroup(group.id)}
                    disabled={!newMemberEmail.trim()}
                  >
                    Invite
                  </Button>
                </div>

                {/* Members List */}
                <div>
                  <h4 className="font-medium mb-2">Members</h4>
                  <div className="space-y-2">
                    {members[group.id]?.map((member) => (
                      <div
                        key={member.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <span className="font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            ({member.user.email})
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {member.role}
                          </Badge>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMember(group.id, member.userId)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {!members[group.id]?.length && (
                      <p className="text-muted-foreground text-sm">
                        No members yet
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {groups.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p>
                No groups created yet. Create your first group to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GroupManagement;
