package services

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"strings"
	"time"

	"video-conference-backend/internal/config"
)

// EmailService handles email operations
type EmailService struct {
	config    *config.EmailConfig
	templates *template.Template
}

// NewEmailService creates a new email service
func NewEmailService(cfg *config.EmailConfig) *EmailService {
	// Parse email templates
	tmpl, err := template.ParseFiles(
		"internal/templates/layout.html",
		"internal/templates/welcome.html",
		"internal/templates/password_reset.html",
		"internal/templates/admin_invitation.html",
		"internal/templates/meeting_invitation.html",
		"internal/templates/user_invitation.html",
	)
	if err != nil {
		log.Fatalf("Failed to parse email templates: %v", err)
	}

	return &EmailService{
		config:    cfg,
		templates: tmpl,
	}
}

// EmailMessage represents an email to be sent
type EmailMessage struct {
	To      []string
	Subject string
	Body    string
	IsHTML  bool
}

// SendEmail sends an email message
func (s *EmailService) SendEmail(msg EmailMessage) error {
	if s.config.Host == "" {
		log.Printf("📧 Email sending disabled (no SMTP host) - would send to %v: %s", msg.To, msg.Subject)
		return nil
	}

	// Prepare the email headers and body
	header := make(map[string]string)
	header["From"] = fmt.Sprintf("%s <%s>", s.config.FromName, s.config.From)
	header["To"] = strings.Join(msg.To, ",")
	header["Subject"] = msg.Subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=UTF-8"

	// Construct the message
	message := ""
	for key, value := range header {
		message += fmt.Sprintf("%s: %s\r", key, value)
	}
	message += "\r" + msg.Body

	// Configure SMTP authentication
	auth := smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)

	// Send the email
	smtpAddr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	err := smtp.SendMail(smtpAddr, auth, s.config.From, msg.To, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("📧 Email sent successfully to %v: %s", msg.To, msg.Subject)
	return nil
}

func (s *EmailService) executeTemplate(templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
	if err := s.templates.ExecuteTemplate(&body, templateName, data); err != nil {
		return "", fmt.Errorf("failed to execute template %s: %w", templateName, err)
	}
	return body.String(), nil
}

// SendInvitationEmail sends a meeting invitation email
func (s *EmailService) SendInvitationEmail(to []string, emailContent EmailContent) error {
	// This function is deprecated. Use SendMeetingInvitationEmail instead.
	log.Printf("Warning: SendInvitationEmail is deprecated. Use SendMeetingInvitationEmail instead.")
	return nil
}

// SendWelcomeEmail sends a welcome email to new users
func (s *EmailService) SendWelcomeEmail(to, name string) error {
	data := struct {
		Subject string
		Body    template.HTML
		Name    string
	}{
		Subject: "Welcome to Video Conference Platform",
		Name:    name,
	}

	bodyContent, err := s.executeTemplate("welcome.html", data)
	if err != nil {
		return err
	}
	data.Body = template.HTML(bodyContent)

	htmlBody, err := s.executeTemplate("layout.html", data)
	if err != nil {
		return err
	}

	msg := EmailMessage{
		To:      []string{to},
		Subject: data.Subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendPasswordResetEmail sends a password reset email
func (s *EmailService) SendPasswordResetEmail(to, resetLink string, expiryHours int) error {
	data := struct {
		Subject     string
		Body        template.HTML
		ResetLink   string
		ExpiryHours int
	}{
		Subject:     "Reset Your Password",
		ResetLink:   resetLink,
		ExpiryHours: expiryHours,
	}

	bodyContent, err := s.executeTemplate("password_reset.html", data)
	if err != nil {
		return err
	}
	data.Body = template.HTML(bodyContent)

	htmlBody, err := s.executeTemplate("layout.html", data)
	if err != nil {
		return err
	}

	msg := EmailMessage{
		To:      []string{to},
		Subject: data.Subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendAdminInvitation sends an admin invitation email
func (s *EmailService) SendAdminInvitation(ctx context.Context, to string, data map[string]interface{}) error {
	firstName := data["first_name"].(string)
	lastName := data["last_name"].(string)
	invitationURL := data["invitation_url"].(string)
	expiresAt := data["expires_at"].(time.Time)

	templateData := struct {
		Subject       string
		Body          template.HTML
		FirstName     string
		LastName      string
		InvitationURL string
		ExpiresAt     string
	}{
		Subject:       "Admin Invitation - Video Conference Platform",
		FirstName:     firstName,
		LastName:      lastName,
		InvitationURL: invitationURL,
		ExpiresAt:     expiresAt.Format("January 2, 2006 at 3:04 PM"),
	}

	bodyContent, err := s.executeTemplate("admin_invitation.html", templateData)
	if err != nil {
		return err
	}
	templateData.Body = template.HTML(bodyContent)

	htmlBody, err := s.executeTemplate("layout.html", templateData)
	if err != nil {
		return err
	}

	msg := EmailMessage{
		To:      []string{to},
		Subject: templateData.Subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendMeetingInvitationEmail sends a meeting invitation email
func (s *EmailService) SendMeetingInvitationEmail(to []string, meetingTitle, meetingDescription, meetingLink string, scheduledStart, scheduledEnd time.Time) error {
	data := struct {
		Subject            string
		Body               template.HTML
		MeetingTitle       string
		MeetingDescription string
		MeetingLink        string
		ScheduledStart     string
		ScheduledEnd       string
	}{
		Subject:            fmt.Sprintf("Meeting Invitation: %s", meetingTitle),
		MeetingTitle:       meetingTitle,
		MeetingDescription: meetingDescription,
		MeetingLink:        meetingLink,
		ScheduledStart:     scheduledStart.Format("January 2, 2006 3:04 PM MST"),
		ScheduledEnd:       scheduledEnd.Format("January 2, 2006 3:04 PM MST"),
	}

	bodyContent, err := s.executeTemplate("meeting_invitation.html", data)
	if err != nil {
		return err
	}
	data.Body = template.HTML(bodyContent)

	htmlBody, err := s.executeTemplate("layout.html", data)
	if err != nil {
		return err
	}

	msg := EmailMessage{
		To:      to,
		Subject: data.Subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendUserInvitationEmail sends a user invitation email
func (s *EmailService) SendUserInvitationEmail(to, firstName, inviterName, invitationLink string, expiresAt time.Time) error {
	data := struct {
		Subject        string
		Body           template.HTML
		FirstName      string
		InviterName    string
		InvitationLink string
		ExpiresAt      string
	}{
		Subject:        "You're Invited to Video Conference Platform!",
		FirstName:      firstName,
		InviterName:    inviterName,
		InvitationLink: invitationLink,
		ExpiresAt:      expiresAt.Format("January 2, 2006 at 3:04 PM"),
	}

	bodyContent, err := s.executeTemplate("user_invitation.html", data)
	if err != nil {
		return err
	}
	data.Body = template.HTML(bodyContent)

	htmlBody, err := s.executeTemplate("layout.html", data)
	if err != nil {
		return err
	}

	msg := EmailMessage{
		To:      []string{to},
		Subject: data.Subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// EmailContent represents the content structure for emails
type EmailContent struct {
	Subject     string
	Body        string
	HTMLBody    string
	MeetingLink string
}

// SendLater schedules an email to be sent after a delay
func (s *EmailService) SendLater(delay time.Duration, msg EmailMessage) {
	go func() {
		time.Sleep(delay)
		err := s.SendEmail(msg)
		if err != nil {
			log.Printf("Failed to send scheduled email after %s: %v", delay, err)
		}
	}()
}
