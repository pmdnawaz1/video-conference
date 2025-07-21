import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const InvitationForm = ({ meeting, onSendInvitations, onCancel }) => {
  const [emails, setEmails] = useState(['']);
  const [isLoading, setIsLoading] = useState(false);

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Filter out empty emails and validate
    const validEmails = emails.filter(email => email.trim() && isValidEmail(email.trim()));
    
    if (validEmails.length === 0) {
      alert('Please enter at least one valid email address');
      setIsLoading(false);
      return;
    }

    try {
      await onSendInvitations(validEmails);
    } catch (error) {
      console.error('Error sending invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Meeting Info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900">{meeting.title}</h3>
        <p className="text-sm text-blue-700 mt-1">{meeting.description}</p>
        <p className="text-sm text-blue-600 mt-2">
          📅 {formatDateTime(meeting.scheduled_start)} - {formatDateTime(meeting.scheduled_end)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Invite People (Email Addresses)
          </label>
          
          {emails.map((email, index) => (
            <div key={index} className="flex space-x-2 mb-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => updateEmail(index, e.target.value)}
                placeholder="Enter email address"
                className="flex-1"
                required={index === 0}
              />
              {emails.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeEmailField(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmailField}
            className="mt-2"
          >
            + Add Another Email
          </Button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">What will be sent:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✉️ Email invitation with meeting details</li>
            <li>📅 Calendar event (Google Calendar, Outlook, ICS file)</li>
            <li>🔗 Secure meeting link with invitation token</li>
            <li>📱 Instructions to join the meeting</li>
          </ul>
        </div>

        <div className="flex space-x-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Sending Invitations...' : 'Send Invitations'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InvitationForm;