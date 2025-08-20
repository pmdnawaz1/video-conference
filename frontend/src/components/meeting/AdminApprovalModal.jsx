import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
// Simple Badge component inline to avoid dependency issues
const Badge = ({ children, variant = "default", className = "", ...props }) => {
  const baseClasses =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold";
  const variantClasses = {
    default: "border-transparent bg-blue-600 text-white",
    outline:
      "text-muted-foreground border-gray-300 bg-transparent dark:text-muted-foreground dark:border-gray-600",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
import { Card } from "../ui/card";
import { Mic, Video, Monitor, Clock, User } from "lucide-react";

const AdminApprovalModal = ({
  isOpen,
  onClose,
  permissionRequests = [],
  onApprove,
  onDeny,
  onBulkAction,
}) => {
  const getPermissionIcon = (permission) => {
    switch (permission) {
      case "audio":
        return <Mic className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "screen":
        return <Monitor className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getPermissionLabel = (permission) => {
    switch (permission) {
      case "audio":
        return "Microphone";
      case "video":
        return "Camera";
      case "screen":
        return "Screen Share";
      default:
        return permission;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const hasRequests = permissionRequests && permissionRequests.length > 0;

  const handleApprove = (requestId, userId, permissions) => {
    onApprove(requestId, userId, permissions);
  };

  const handleDeny = (requestId, userId) => {
    onDeny(requestId, userId);
  };

  const handleBulkApprove = () => {
    onBulkAction("approve");
  };

  const handleBulkDeny = () => {
    onBulkAction("deny");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Permission Requests
          </DialogTitle>
          <DialogDescription>
            Review and manage participant permission requests for this meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!hasRequests ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No permission requests at this time</p>
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <div className="text-sm text-muted-foreground">
                  {permissionRequests.length} pending request
                  {permissionRequests.length !== 1 ? "s" : ""}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkApprove}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    Approve All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDeny}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Deny All
                  </Button>
                </div>
              </div>

              {/* Requests List */}
              <div className="space-y-3 overflow-y-auto max-h-96">
                {permissionRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                            {request.userName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium truncate">
                              {request.userName}
                            </h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(request.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {request.permissions.map((permission) => (
                            <Badge
                              key={permission}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {getPermissionIcon(permission)}
                              {getPermissionLabel(permission)}
                            </Badge>
                          ))}
                        </div>

                        {request.message && (
                          <div className="bg-muted/50 rounded-md p-2 text-sm">
                            <p className="text-muted-foreground text-xs mb-1">
                              Message:
                            </p>
                            <p>"{request.message}"</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleApprove(
                              request.id,
                              request.userId,
                              request.permissions,
                            )
                          }
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeny(request.id, request.userId)}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminApprovalModal;
