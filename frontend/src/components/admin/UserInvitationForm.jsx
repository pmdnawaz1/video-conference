import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import {
  Loader2,
  Mail,
  Users,
  UserPlus,
  Download,
  Upload,
  Trash2,
  Copy,
  Check,
  X,
  AlertCircle,
  Info,
} from "lucide-react";
import userInvitationService from "../../services/UserInvitationService";
import useAdminStore from "../../stores/adminStore";
import useAuthStore from "../../stores/authStore";

const UserInvitationForm = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuthStore();
  const { organizations, currentOrganization, userGroups, fetchUserGroups } =
    useAdminStore();

  // Form states
  const [activeTab, setActiveTab] = useState("single");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);

  // Single invitation form state
  const [singleForm, setSingleForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "user",
    department: "",
    customMessage: "",
    sendEmail: true,
    groups: [],
    permissions: [],
    expiryDays: 7,
  });

  // Bulk invitation state
  const [bulkForm, setBulkForm] = useState({
    invitations: [],
    defaultRole: "user",
    defaultDepartment: "",
    customMessage: "",
    sendEmails: true,
    defaultGroups: [],
    expiryDays: 7,
  });

  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);

  // Available roles and permissions
  const availableRoles = [
    { value: "user", label: "User", description: "Standard user access" },
    { value: "admin", label: "Admin", description: "Administrative access" },
    {
      value: "manager",
      label: "Manager",
      description: "Department manager access",
    },
  ];

  const availablePermissions = [
    {
      id: "create_meetings",
      label: "Create Meetings",
      description: "Can create and schedule meetings",
    },
    {
      id: "manage_recordings",
      label: "Manage Recordings",
      description: "Can access and manage recordings",
    },
    {
      id: "view_analytics",
      label: "View Analytics",
      description: "Can view meeting analytics",
    },
    {
      id: "export_data",
      label: "Export Data",
      description: "Can export meeting data and reports",
    },
  ];

  useEffect(() => {
    if (open) {
      fetchUserGroups();
      resetForms();
    }
  }, [open, fetchUserGroups]);

  const resetForms = () => {
    setSingleForm({
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
      department: "",
      customMessage: "",
      sendEmail: true,
      groups: [],
      permissions: [],
      expiryDays: 7,
    });

    setBulkForm({
      invitations: [],
      defaultRole: "user",
      defaultDepartment: "",
      customMessage: "",
      sendEmails: true,
      defaultGroups: [],
      expiryDays: 7,
    });

    setCsvFile(null);
    setCsvPreview([]);
    setBulkResults(null);
    setErrors({});
    setSuccess(null);
  };

  // Single invitation handlers
  const handleSingleFormChange = (field, value) => {
    setSingleForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateSingleForm = () => {
    const newErrors = {};

    if (!singleForm.email) {
      newErrors.email = "Email is required";
    } else if (!userInvitationService.validateEmail(singleForm.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!singleForm.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!singleForm.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (singleForm.expiryDays < 1 || singleForm.expiryDays > 30) {
      newErrors.expiryDays = "Expiry must be between 1 and 30 days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSingleInvitation = async () => {
    if (!validateSingleForm()) return;

    setIsLoading(true);
    setSuccess(null);

    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + singleForm.expiryDays);

      const result = await userInvitationService.createUserInvitation({
        email: singleForm.email,
        firstName: singleForm.firstName,
        lastName: singleForm.lastName,
        role: singleForm.role,
        department: singleForm.department || null,
        organizationId: currentOrganization?.id,
        invitedBy: user?.id,
        expiresAt: expiryDate.toISOString(),
        sendEmail: singleForm.sendEmail,
        customMessage: singleForm.customMessage || null,
        permissions: singleForm.permissions,
        groups: singleForm.groups,
      });

      if (result.success) {
        setSuccess({
          type: "single",
          message: `Invitation sent successfully to ${singleForm.email}`,
          invitation: result.invitation,
          token: result.token,
        });

        if (onSuccess) {
          onSuccess(result.invitation);
        }

        // Reset form for next invitation
        setSingleForm((prev) => ({
          ...prev,
          email: "",
          firstName: "",
          lastName: "",
          department: "",
        }));
      } else {
        setErrors({ submit: result.error });
      }
    } catch (error) {
      setErrors({ submit: "Failed to send invitation. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk invitation handlers
  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setErrors({ csv: "Please upload a CSV file" });
      return;
    }

    setCsvFile(file);
    setErrors({ csv: null });

    // Parse CSV file
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text
        .split("")
        .map((row) => row.split(",").map((cell) => cell.trim()));

      // Skip header row and empty rows
      const dataRows = rows
        .slice(1)
        .filter((row) => row.some((cell) => cell.length > 0));

      const parsed = dataRows.map((row, index) => ({
        id: index,
        email: row[0] || "",
        firstName: row[1] || "",
        lastName: row[2] || "",
        department: row[3] || bulkForm.defaultDepartment,
        role: row[4] || bulkForm.defaultRole,
        isValid:
          userInvitationService.validateEmail(row[0]) && row[1] && row[2],
      }));

      setCsvPreview(parsed);
      setBulkForm((prev) => ({ ...prev, invitations: parsed }));
    };

    reader.readAsText(file);
  };

  const handleBulkInvitations = async () => {
    if (bulkForm.invitations.length === 0) {
      setErrors({ bulk: "No invitations to send" });
      return;
    }

    const validInvitations = bulkForm.invitations.filter((inv) => inv.isValid);
    if (validInvitations.length === 0) {
      setErrors({ bulk: "No valid invitations found" });
      return;
    }

    setIsLoading(true);
    setSuccess(null);

    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + bulkForm.expiryDays);

      const invitationsData = validInvitations.map((invitation) => ({
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
        department: invitation.department,
        organizationId: currentOrganization?.id,
        invitedBy: user?.id,
        expiresAt: expiryDate.toISOString(),
        sendEmail: bulkForm.sendEmails,
        customMessage: bulkForm.customMessage || null,
        permissions: [],
        groups: bulkForm.defaultGroups,
      }));

      const result =
        await userInvitationService.createBulkUserInvitations(invitationsData);

      if (result.success) {
        setBulkResults(result);
        setSuccess({
          type: "bulk",
          message: `Successfully sent ${result.successful} of ${validInvitations.length} invitations`,
          results: result,
        });

        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        setErrors({ bulk: result.error });
      }
    } catch (error) {
      setErrors({ bulk: "Failed to send bulk invitations. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent =
      "email,first_name,last_name,department,roleexample@company.com,John,Doe,Engineering,user";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "user_invitation_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyInvitationUrl = (token) => {
    const url = userInvitationService.generateInvitationUrl(token);
    navigator.clipboard.writeText(url).then(() => {
      setSuccess((prev) => ({ ...prev, copied: true }));
      setTimeout(() => {
        setSuccess((prev) => ({ ...prev, copied: false }));
      }, 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite Users
          </DialogTitle>
          <DialogDescription>
            Send invitations to new users to join your organization
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Single Invitation
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Bulk Invitations
            </TabsTrigger>
          </TabsList>

          {/* Single Invitation Tab */}
          <TabsContent value="single" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={singleForm.email}
                  onChange={(e) =>
                    handleSingleFormChange("email", e.target.value)
                  }
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={singleForm.firstName}
                  onChange={(e) =>
                    handleSingleFormChange("firstName", e.target.value)
                  }
                  className={errors.firstName ? "border-red-500" : ""}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={singleForm.lastName}
                  onChange={(e) =>
                    handleSingleFormChange("lastName", e.target.value)
                  }
                  className={errors.lastName ? "border-red-500" : ""}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="Engineering"
                  value={singleForm.department}
                  onChange={(e) =>
                    handleSingleFormChange("department", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={singleForm.role}
                  onValueChange={(value) =>
                    handleSingleFormChange("role", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {role.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDays">Expires in (days)</Label>
                <Input
                  id="expiryDays"
                  type="number"
                  min="1"
                  max="30"
                  value={singleForm.expiryDays}
                  onChange={(e) =>
                    handleSingleFormChange(
                      "expiryDays",
                      parseInt(e.target.value),
                    )
                  }
                  className={errors.expiryDays ? "border-red-500" : ""}
                />
                {errors.expiryDays && (
                  <p className="text-sm text-destructive">
                    {errors.expiryDays}
                  </p>
                )}
              </div>
            </div>

            {/* Groups and Permissions */}
            {userGroups.length > 0 && (
              <div className="space-y-2">
                <Label>User Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {userGroups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={singleForm.groups.includes(group.id)}
                        onCheckedChange={(checked) => {
                          const newGroups = checked
                            ? [...singleForm.groups, group.id]
                            : singleForm.groups.filter((id) => id !== group.id);
                          handleSingleFormChange("groups", newGroups);
                        }}
                      />
                      <Label htmlFor={`group-${group.id}`} className="text-sm">
                        {group.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availablePermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-start space-x-2"
                  >
                    <Checkbox
                      id={`permission-${permission.id}`}
                      checked={singleForm.permissions.includes(permission.id)}
                      onCheckedChange={(checked) => {
                        const newPermissions = checked
                          ? [...singleForm.permissions, permission.id]
                          : singleForm.permissions.filter(
                              (id) => id !== permission.id,
                            );
                        handleSingleFormChange("permissions", newPermissions);
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={`permission-${permission.id}`}
                        className="text-sm font-medium"
                      >
                        {permission.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customMessage">Custom Message (Optional)</Label>
              <Textarea
                id="customMessage"
                placeholder="Add a personal message to the invitation email..."
                value={singleForm.customMessage}
                onChange={(e) =>
                  handleSingleFormChange("customMessage", e.target.value)
                }
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendEmail"
                checked={singleForm.sendEmail}
                onCheckedChange={(checked) =>
                  handleSingleFormChange("sendEmail", checked)
                }
              />
              <Label htmlFor="sendEmail" className="text-sm">
                Send invitation email immediately
              </Label>
            </div>

            {errors.submit && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{errors.submit}</p>
              </div>
            )}

            {success?.type === "single" && (
              <Card className="border-success/20 bg-success/10">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-success" />
                    <p className="text-sm text-success font-medium">
                      {success.message}
                    </p>
                  </div>
                  {success.token && (
                    <div className="space-y-2">
                      <Label className="text-sm">Invitation Link:</Label>
                      <div className="flex gap-2">
                        <Input
                          value={userInvitationService.generateInvitationUrl(
                            success.token,
                          )}
                          readOnly
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyInvitationUrl(success.token)}
                        >
                          {success.copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Bulk Invitation Tab */}
          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload CSV File
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with user information. Download the template
                  to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadCsvTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload CSV
                    </Button>
                  </div>
                </div>

                {errors.csv && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <p className="text-sm text-destructive">{errors.csv}</p>
                  </div>
                )}

                {csvPreview.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        Preview ({csvPreview.length} entries)
                      </h4>
                      <Badge
                        variant={
                          csvPreview.filter((inv) => inv.isValid).length ===
                          csvPreview.length
                            ? "default"
                            : "destructive"
                        }
                      >
                        {csvPreview.filter((inv) => inv.isValid).length} valid,{" "}
                        {csvPreview.filter((inv) => !inv.isValid).length}{" "}
                        invalid
                      </Badge>
                    </div>

                    <ScrollArea className="h-64 border rounded-md">
                      <div className="p-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Email</th>
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Department</th>
                              <th className="text-left p-2">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((invitation, index) => (
                              <tr
                                key={index}
                                className={`border-b ${invitation.isValid ? "" : "bg-red-50"}`}
                              >
                                <td className="p-2">
                                  {invitation.isValid ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <X className="w-4 h-4 text-destructive" />
                                  )}
                                </td>
                                <td className="p-2">{invitation.email}</td>
                                <td className="p-2">{`${invitation.firstName} ${invitation.lastName}`}</td>
                                <td className="p-2">{invitation.department}</td>
                                <td className="p-2">{invitation.role}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>

                    {/* Bulk settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bulkDefaultRole">Default Role</Label>
                        <Select
                          value={bulkForm.defaultRole}
                          onValueChange={(value) =>
                            setBulkForm((prev) => ({
                              ...prev,
                              defaultRole: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bulkDefaultDepartment">
                          Default Department
                        </Label>
                        <Input
                          id="bulkDefaultDepartment"
                          placeholder="Engineering"
                          value={bulkForm.defaultDepartment}
                          onChange={(e) =>
                            setBulkForm((prev) => ({
                              ...prev,
                              defaultDepartment: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bulkExpiryDays">
                          Expires in (days)
                        </Label>
                        <Input
                          id="bulkExpiryDays"
                          type="number"
                          min="1"
                          max="30"
                          value={bulkForm.expiryDays}
                          onChange={(e) =>
                            setBulkForm((prev) => ({
                              ...prev,
                              expiryDays: parseInt(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bulkCustomMessage">
                        Custom Message (Optional)
                      </Label>
                      <Textarea
                        id="bulkCustomMessage"
                        placeholder="Add a message to all invitation emails..."
                        value={bulkForm.customMessage}
                        onChange={(e) =>
                          setBulkForm((prev) => ({
                            ...prev,
                            customMessage: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sendBulkEmails"
                        checked={bulkForm.sendEmails}
                        onCheckedChange={(checked) =>
                          setBulkForm((prev) => ({
                            ...prev,
                            sendEmails: checked,
                          }))
                        }
                      />
                      <Label htmlFor="sendBulkEmails" className="text-sm">
                        Send invitation emails immediately
                      </Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {errors.bulk && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{errors.bulk}</p>
              </div>
            )}

            {bulkResults && (
              <Card className="border-success/20 bg-success/10">
                <CardHeader>
                  <CardTitle className="text-lg text-success">
                    Bulk Invitation Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {bulkResults.successful}
                      </div>
                      <div className="text-sm text-success">Successful</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {bulkResults.failed}
                      </div>
                      <div className="text-sm text-destructive">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {bulkResults.successful + bulkResults.failed}
                      </div>
                      <div className="text-sm text-blue-700">Total</div>
                    </div>
                  </div>

                  {bulkResults.errors && bulkResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive">Errors:</h4>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {bulkResults.errors.map((error, index) => (
                            <div
                              key={index}
                              className="text-sm text-red-600 bg-white p-2 rounded border"
                            >
                              <strong>{error.email}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>
            Cancel
          </Button>
          <Button
            onClick={
              activeTab === "single"
                ? handleSingleInvitation
                : handleBulkInvitations
            }
            disabled={
              isLoading || (activeTab === "bulk" && csvPreview.length === 0)
            }
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {activeTab === "single"
              ? "Send Invitation"
              : "Send Bulk Invitations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserInvitationForm;
