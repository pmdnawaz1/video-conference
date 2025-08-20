import React, { useState, useRef, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiBuilding,
  FiGlobe,
  FiCamera,
  FiUpload,
  FiSave,
  FiX,
  FiEdit3,
  FaCheckCircle,
  FiCalendar,
  FiBriefcase,
  FiLinkedin,
  FiGithub,
  FiTwitter,
  FiInstagram,
} from "react-icons/fi";
import { format } from "date-fns";
import useUserStore from "../../stores/userStore";
import useAuthStore from "../../stores/authStore";

const ProfileEditor = ({ onClose }) => {
  const { user, updateProfile: updateAuthProfile } = useAuthStore();
  const { profile, updateProfile, isProfileUpdating, profileError } =
    useUserStore();

  const [formData, setFormData] = useState({
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    email: user?.email || "",
    phone: profile?.phone || "",
    bio: profile?.bio || "",
    title: profile?.title || "",
    department: profile?.department || "",
    company: profile?.company || "",
    location: profile?.location || "",
    timezone:
      profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    website: profile?.website || "",
    linkedin: profile?.social?.linkedin || "",
    github: profile?.social?.github || "",
    twitter: profile?.social?.twitter || "",
    instagram: profile?.social?.instagram || "",
    skills: profile?.skills || [],
    languages: profile?.languages || [],
    avatar: profile?.avatar || user?.avatar || null,
  });

  const [isEditing, setIsEditing] = useState({});
  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Check if form has been modified
    const hasChanges =
      JSON.stringify(formData) !==
      JSON.stringify({
        firstName: user?.first_name || "",
        lastName: user?.last_name || "",
        email: user?.email || "",
        phone: profile?.phone || "",
        bio: profile?.bio || "",
        title: profile?.title || "",
        department: profile?.department || "",
        company: profile?.company || "",
        location: profile?.location || "",
        timezone:
          profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        website: profile?.website || "",
        linkedin: profile?.social?.linkedin || "",
        github: profile?.social?.github || "",
        twitter: profile?.social?.twitter || "",
        instagram: profile?.social?.instagram || "",
        skills: profile?.skills || [],
        languages: profile?.languages || [],
        avatar: profile?.avatar || user?.avatar || null,
      });
    setIsDirty(hasChanges);
  }, [formData, user, profile]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSocialChange = (platform, value) => {
    setFormData((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
        setFormData((prev) => ({
          ...prev,
          avatar: e.target.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const addLanguage = () => {
    if (
      newLanguage.trim() &&
      !formData.languages.includes(newLanguage.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()],
      }));
      setNewLanguage("");
    }
  };

  const removeLanguage = (languageToRemove) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter(
        (language) => language !== languageToRemove,
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prepare data for API
    const profileData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone,
      bio: formData.bio,
      title: formData.title,
      department: formData.department,
      company: formData.company,
      location: formData.location,
      timezone: formData.timezone,
      website: formData.website,
      skills: formData.skills,
      languages: formData.languages,
      social: {
        linkedin: formData.linkedin,
        github: formData.github,
        twitter: formData.twitter,
        instagram: formData.instagram,
      },
      avatar:
        formData.avatar !== (profile?.avatar || user?.avatar)
          ? formData.avatar
          : undefined,
    };

    const result = await updateProfile(profileData);

    if (result.success) {
      // Update auth store if name changed
      if (
        formData.firstName !== user?.first_name ||
        formData.lastName !== user?.last_name
      ) {
        updateAuthProfile({
          first_name: formData.firstName,
          last_name: formData.lastName,
        });
      }

      setIsDirty(false);
      if (onClose) onClose();
    }
  };

  const toggleEdit = (field) => {
    setIsEditing((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const getInitials = () => {
    return `${formData.firstName?.charAt(0) || ""}${formData.lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
    "Africa/Cairo",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
          <p className="text-muted-foreground">
            Update your personal information and preferences
          </p>
        </div>

        {onClose && (
          <Button variant="outline" onClick={onClose}>
            <FiX className="w-4 h-4 mr-2" />
            Close
          </Button>
        )}
      </div>

      {profileError && (
        <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
          <p className="text-red-600 dark:text-red-400">{profileError}</p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profile Photo</h3>
          <div className="flex items-center space-x-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || formData.avatar} />
                <AvatarFallback className="text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="sm"
                className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiCamera className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div>
              <h4 className="font-medium">Change Avatar</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Upload a new profile photo. Max size 5MB.
              </p>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUpload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                {(avatarPreview || formData.avatar) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAvatarPreview(null);
                      setFormData((prev) => ({ ...prev, avatar: null }));
                    }}
                  >
                    <FiX className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Basic Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name *</label>
              <Input
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="Enter your first name"
                required
                aria-label="First name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name *</label>
              <Input
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Enter your last name"
                required
                aria-label="Last name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter your email"
                required
                disabled={true} // Usually email can't be changed
                aria-label="Email address"
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter your phone number"
                aria-label="Phone number"
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
              rows={4}
              value={formData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={500}
              aria-label="Biography"
            />
            <p className="text-xs text-muted-foreground">
              {formData.bio.length}/500 characters
            </p>
          </div>
        </Card>

        {/* Professional Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Professional Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Title</label>
              <Input
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="e.g., Software Engineer"
                aria-label="Job title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Input
                value={formData.department}
                onChange={(e) =>
                  handleInputChange("department", e.target.value)
                }
                placeholder="e.g., Engineering"
                aria-label="Department"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Input
                value={formData.company}
                onChange={(e) => handleInputChange("company", e.target.value)}
                placeholder="Enter your company name"
                aria-label="Company"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Website</label>
              <Input
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://your-website.com"
                aria-label="Website"
              />
            </div>
          </div>
        </Card>

        {/* Location & Timezone */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Location & Timezone</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="e.g., New York, NY"
                aria-label="Location"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange("timezone", value)}
              >
                <SelectTrigger aria-label="Select timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Social Media */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Social Media</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <FiLinkedin className="w-4 h-4 mr-2" />
                LinkedIn
              </label>
              <Input
                value={formData.linkedin}
                onChange={(e) => handleSocialChange("linkedin", e.target.value)}
                placeholder="LinkedIn profile URL"
                aria-label="LinkedIn profile"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <FiGithub className="w-4 h-4 mr-2" />
                GitHub
              </label>
              <Input
                value={formData.github}
                onChange={(e) => handleSocialChange("github", e.target.value)}
                placeholder="GitHub profile URL"
                aria-label="GitHub profile"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <FiTwitter className="w-4 h-4 mr-2" />
                Twitter
              </label>
              <Input
                value={formData.twitter}
                onChange={(e) => handleSocialChange("twitter", e.target.value)}
                placeholder="Twitter profile URL"
                aria-label="Twitter profile"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <FiInstagram className="w-4 h-4 mr-2" />
                Instagram
              </label>
              <Input
                value={formData.instagram}
                onChange={(e) =>
                  handleSocialChange("instagram", e.target.value)
                }
                placeholder="Instagram profile URL"
                aria-label="Instagram profile"
              />
            </div>
          </div>
        </Card>

        {/* Skills & Languages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Skills</h3>

            <div className="flex space-x-2 mb-4">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill..."
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                aria-label="Add skill"
              />
              <Button
                type="button"
                onClick={addSkill}
                disabled={!newSkill.trim()}
              >
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                    aria-label={`Remove ${skill} skill`}
                  >
                    <FiX className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Languages</h3>

            <div className="flex space-x-2 mb-4">
              <Input
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Add a language..."
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLanguage();
                  }
                }}
                aria-label="Add language"
              />
              <Button
                type="button"
                onClick={addLanguage}
                disabled={!newLanguage.trim()}
              >
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.languages.map((language, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{language}</span>
                  <button
                    type="button"
                    onClick={() => removeLanguage(language)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                    aria-label={`Remove ${language} language`}
                  >
                    <FiX className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isDirty) {
                const confirmDiscard = confirm(
                  "You have unsaved changes. Are you sure you want to discard them?",
                );
                if (!confirmDiscard) return;
              }
              if (onClose) onClose();
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isProfileUpdating || !isDirty}
            className="min-w-[120px]"
          >
            {isProfileUpdating ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileEditor;
