import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

const PermissionRequestModal = ({ isOpen, onClose, onSendRequest }) => {
  const [requestVideo, setRequestVideo] = useState(false);
  const [requestAudio, setRequestAudio] = useState(false);
  const [requestScreen, setRequestScreen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    const requestedPermissions = [];
    if (requestVideo) requestedPermissions.push("video");
    if (requestAudio) requestedPermissions.push("audio");
    if (requestScreen) requestedPermissions.push("screen");

    if (requestedPermissions.length === 0) {
      alert("Please select at least one permission to request.");
      return;
    }

    onSendRequest(requestedPermissions, message);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Permission</DialogTitle>
          <DialogDescription>
            Ask the meeting admin for permission to use your camera, microphone,
            or share your screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requestVideo"
              checked={requestVideo}
              onCheckedChange={setRequestVideo}
            />
            <Label htmlFor="requestVideo">Camera</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requestAudio"
              checked={requestAudio}
              onCheckedChange={setRequestAudio}
            />
            <Label htmlFor="requestAudio">Microphone</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requestScreen"
              checked={requestScreen}
              onCheckedChange={setRequestScreen}
            />
            <Label htmlFor="requestScreen">Screen Sharing</Label>
          </div>
          <Textarea
            placeholder="Optional message to admin..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Send Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionRequestModal;
