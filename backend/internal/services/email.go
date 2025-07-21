package services

import (
	"fmt"
	"log"
	"net/smtp"
	"strings"

	"video-conference-backend/internal/config"
)

// EmailService handles email operations
type EmailService struct {
	config *config.EmailConfig
}

// NewEmailService creates a new email service
func NewEmailService(cfg *config.EmailConfig) *EmailService {
	return &EmailService{
		config: cfg,
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
	if s.config.SMTPHost == "" {
		log.Printf("📧 Email sending disabled (no SMTP host) - would send to %v: %s", msg.To, msg.Subject)
		return nil
	}

	// Prepare the email headers and body
	header := make(map[string]string)
	header["From"] = fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail)
	header["To"] = strings.Join(msg.To, ",")
	header["Subject"] = msg.Subject
	header["MIME-Version"] = "1.0"
	
	if msg.IsHTML {
		header["Content-Type"] = "text/html; charset=UTF-8"
	} else {
		header["Content-Type"] = "text/plain; charset=UTF-8"
	}

	// Construct the message
	message := ""
	for key, value := range header {
		message += fmt.Sprintf("%s: %s\r\n", key, value)
	}
	message += "\r\n" + msg.Body

	// Configure SMTP authentication
	auth := smtp.PlainAuth("", s.config.SMTPUsername, s.config.SMTPPassword, s.config.SMTPHost)

	// Send the email
	smtpAddr := fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort)
	err := smtp.SendMail(smtpAddr, auth, s.config.FromEmail, msg.To, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("📧 Email sent successfully to %v: %s", msg.To, msg.Subject)
	return nil
}

// SendInvitationEmail sends a meeting invitation email
func (s *EmailService) SendInvitationEmail(to []string, emailContent EmailContent) error {
	msg := EmailMessage{
		To:      to,
		Subject: emailContent.Subject,
		Body:    emailContent.HTMLBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendWelcomeEmail sends a welcome email to new users
func (s *EmailService) SendWelcomeEmail(to, name string) error {
	subject := "Welcome to Video Conference Platform"
	
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Welcome to Video Conference Platform</h2>
        </div>
        <div class="content">
            <p>Hi %s,</p>
            <p>Welcome to our Enterprise Video Conference Platform! Your account has been successfully created.</p>
            <p>You can now:</p>
            <ul>
                <li>Schedule and join video meetings</li>
                <li>Invite colleagues to meetings</li>
                <li>Use advanced features like screen sharing and recording</li>
                <li>Manage your meeting preferences</li>
            </ul>
            <p>Get started by logging into your account and exploring the platform.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>Video Conference Platform Team</p>
        </div>
    </div>
</body>
</html>
`, name)

	msg := EmailMessage{
		To:      []string{to},
		Subject: subject,
		Body:    htmlBody,
		IsHTML:  true,
	}

	return s.SendEmail(msg)
}

// SendPasswordResetEmail sends a password reset email
func (s *EmailService) SendPasswordResetEmail(to, resetLink string) error {
	subject := "Reset Your Password"
	
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .reset-button { display: inline-block; background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Password Reset Request</h2>
        </div>
        <div class="content">
            <p>Hi,</p>
            <p>You requested to reset your password for your Video Conference Platform account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="%s" class="reset-button">Reset Password</a>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>This link will expire in 1 hour for security reasons.</p>
        </div>
        <div class="footer">
            <p>Video Conference Platform Team</p>
        </div>
    </div>
</body>
</html>
`, resetLink)

	msg := EmailMessage{
		To:      []string{to},
		Subject: subject,
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