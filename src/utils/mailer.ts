import nodemailer from "nodemailer";
import { env } from "../config/env";

const canSend =
  env.SMTP_HOST &&
  env.SMTP_PORT &&
  env.SMTP_USER &&
  env.SMTP_PASS &&
  env.SMTP_FROM;

const getTransporter = () =>
  nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

const wrapEmail = (title: string, body: string, actionUrl?: string, actionLabel?: string) => `
<div style="background:#f8fafc;padding:32px;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
      <img src="${env.FRONTEND_URL}/logo-icon-dark-transparent.png" alt="CampusTutor" style="height:36px;width:36px;" />
      <div style="font-size:18px;font-weight:700;color:#0f172a;">CampusTutor</div>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:22px;margin:0 0 12px;color:#0f172a;">${title}</h1>
      <div style="margin:0 0 16px;color:#475569;line-height:1.6;">
        ${body}
      </div>
      ${
        actionUrl
          ? `<a href="${actionUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">${actionLabel ?? "Open CampusTutor"}</a>`
          : ""
      }
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
      © ${new Date().getFullYear()} CampusTutor • Support: ${env.SUPPORT_EMAIL}
    </div>
  </div>
</div>
`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatBody = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br />");

const sendEmail = async (to: string, subject: string, html: string, strict = false) => {
  if (!canSend) {
    if (strict) {
      throw new Error("SMTP configuration is missing. Set SMTP_HOST/PORT/USER/PASS/FROM.");
    }
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  });
};

export const canSendEmails = () => Boolean(canSend);

type SecurityAlertInput = {
  to: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
};

export async function sendSecurityAlertEmail(input: SecurityAlertInput) {
  if (!canSend) return;
  const body = `
    <p style="margin:0 0 12px;">${formatBody(input.message)}</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
      If this was not you, please reset your password or contact support.
    </p>
  `;
  await sendEmail(
    input.to,
    input.title,
    wrapEmail(input.title, body, input.actionUrl, input.actionLabel)
  );
}

type EmailChangeVerificationInput = {
  to: string;
  verifyLink: string;
};

export async function sendEmailChangeVerificationEmail(input: EmailChangeVerificationInput) {
  const body = `
    <p style="margin:0 0 12px;">We received a request to change the email on your CampusTutor account.</p>
    <p style="margin:0 0 12px;">Click the button below to confirm the new email address.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
      If you did not request this change, you can ignore this email.
    </p>
  `;
  await sendEmail(
    input.to,
    "Confirm your new CampusTutor email",
    wrapEmail("Confirm email change", body, input.verifyLink, "Confirm email"),
    true
  );
}

type AccountDeletionEmailInput = {
  to: string;
  confirmLink: string;
};

export async function sendAccountDeletionEmail(input: AccountDeletionEmailInput) {
  const body = `
    <p style="margin:0 0 12px;">We received a request to delete your CampusTutor account.</p>
    <p style="margin:0 0 12px;">This action is permanent and will deactivate your account.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
      If you did not request this change, you can ignore this email.
    </p>
  `;
  await sendEmail(
    input.to,
    "Confirm your CampusTutor account deletion",
    wrapEmail("Confirm account deletion", body, input.confirmLink, "Confirm deletion"),
    true
  );
}

type NewMessageEmailInput = {
  to: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  actionUrl: string;
};

export async function sendNewMessageEmail(input: NewMessageEmailInput) {
  if (!canSend) return;
  const preview = formatBody(input.messagePreview);
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;"><strong>${escapeHtml(
      input.senderName
    )}</strong> sent you a message:</p>
    <div style="margin:0 0 16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
      ${preview}
    </div>
  `;
  await sendEmail(
    input.to,
    "New message on CampusTutor",
    wrapEmail("New message", body, input.actionUrl, "Reply")
  );
}

type ReviewReceivedEmailInput = {
  to: string;
  tutorName: string;
  tuteeName: string;
  rating: number;
  reviewText?: string | null;
  actionUrl: string;
};

export async function sendReviewReceivedEmail(input: ReviewReceivedEmailInput) {
  if (!canSend) return;
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.tutorName)},</p>
    <p style="margin:0 0 12px;">${escapeHtml(
      input.tuteeName
    )} left a review for your session.</p>
    <p style="margin:0 0 12px;"><strong>Rating:</strong> ${input.rating}/5</p>
    ${
      input.reviewText
        ? `<p style="margin:0 0 12px;"><strong>Comment:</strong><br />${formatBody(
            input.reviewText
          )}</p>`
        : ""
    }
  `;
  await sendEmail(
    input.to,
    "New review received",
    wrapEmail("New review received", body, input.actionUrl, "View dashboard")
  );
}

type PaymentStatusEmailInput = {
  to: string;
  recipientName: string;
  statusLabel: string;
  courseName: string;
  actionUrl: string;
};

export async function sendPaymentStatusEmail(input: PaymentStatusEmailInput) {
  if (!canSend) return;
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;">Payment status update: <strong>${escapeHtml(
      input.statusLabel
    )}</strong>.</p>
    <p style="margin:0 0 12px;"><strong>Course:</strong> ${escapeHtml(
      input.courseName
    )}</p>
  `;
  await sendEmail(
    input.to,
    "Payment status update",
    wrapEmail("Payment update", body, input.actionUrl, "View session")
  );
}

type SessionReminderEmailInput = {
  to: string;
  recipientName: string;
  counterpartName: string;
  courseName: string;
  sessionDate: string;
  sessionTime: string;
  locationLine: string;
  hoursBefore: number;
  actionUrl: string;
};

export async function sendSessionReminderEmail(input: SessionReminderEmailInput) {
  if (!canSend) return;
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;">Reminder: your session with ${escapeHtml(
      input.counterpartName
    )} starts in ${input.hoursBefore} hour${input.hoursBefore === 1 ? "" : "s"}.</p>
    <p style="margin:0 0 12px;"><strong>Course:</strong> ${escapeHtml(
      input.courseName
    )}</p>
    <p style="margin:0 0 12px;"><strong>Date:</strong> ${escapeHtml(
      input.sessionDate
    )}</p>
    <p style="margin:0 0 12px;"><strong>Time:</strong> ${escapeHtml(
      input.sessionTime
    )}</p>
    <p style="margin:0 0 12px;"><strong>Location:</strong> ${escapeHtml(
      input.locationLine
    )}</p>
  `;
  await sendEmail(
    input.to,
    `Session reminder (${input.hoursBefore}h)`,
    wrapEmail("Session reminder", body, input.actionUrl, "View session")
  );
}

type ContactEmailInput = {
  name: string;
  email: string;
  message: string;
};

export async function sendContactEmail(input: ContactEmailInput) {
  if (!canSend) {
    throw new Error("SMTP configuration is missing. Set SMTP_HOST/PORT/USER/PASS/FROM.");
  }
  const subjectName = input.name.trim().replace(/\s+/g, " ");
  const safeName = escapeHtml(subjectName);
  const safeEmail = escapeHtml(input.email.trim());
  const safeMessage = escapeHtml(input.message.trim()).replace(/\r?\n/g, "<br />");
  const body = `
    <p style="margin:0 0 12px;"><strong>Name:</strong> ${safeName}</p>
    <p style="margin:0 0 12px;"><strong>Email:</strong> ${safeEmail}</p>
    <p style="margin:0 0 12px;"><strong>Message:</strong><br />${safeMessage}</p>
  `;
  const html = wrapEmail("New contact message", body);
  const transporter = getTransporter();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: env.SUPPORT_EMAIL,
    subject: `New contact message from ${subjectName}`,
    html,
    replyTo: `${input.name} <${input.email}>`,
  });
}

export async function sendEmailVerificationEmail(to: string, verifyLink: string) {
  const html = wrapEmail(
    "Verify your email",
    `
      <p style="margin:0 0 16px;">Thanks for joining CampusTutor! Please confirm your email address to finish setting up your account.</p>
      <p style="margin:0 0 16px;">Click the button below to verify your email.</p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        If you did not create this account, you can safely ignore this email.
      </p>
    `,
    verifyLink,
    "Verify email"
  );
  await sendEmail(to, "Verify your CampusTutor email", html, true);
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = wrapEmail(
    "Reset your password",
    `
      <p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to set a new one.</p>
      <p style="margin:0 0 16px;">This link expires in 1 hour.</p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        If you did not request this, you can safely ignore this email.
      </p>
    `,
    resetLink,
    "Reset password"
  );
  await sendEmail(to, "Reset your CampusTutor password", html, true);
}

type SessionRequestEmailInput = {
  tutorEmail: string;
  tutorName: string;
  tuteeEmail: string;
  tuteeName: string;
  courseName: string;
  message?: string | null;
  locationType?: "online" | "in_person" | null;
  locationDetails?: string | null;
  actionUrl: string;
};

export async function sendSessionRequestEmails(input: SessionRequestEmailInput) {
  if (!canSend) return;
  const tutorBody = `
    <p style="margin:0 0 12px;">Hi ${input.tutorName},</p>
    <p style="margin:0 0 12px;"><strong>${input.tuteeName}</strong> sent you a new tutoring request for <strong>${input.courseName}</strong>.</p>
    ${input.message ? `<p style="margin:0 0 12px;"><em>Message:</em> ${input.message}</p>` : ""}
    ${
      input.locationType
        ? `<p style="margin:0 0 12px;"><strong>Preferred format:</strong> ${
            input.locationType === "online" ? "Online" : "In person"
          }${input.locationDetails ? ` • ${input.locationDetails}` : ""}</p>`
        : ""
    }
  `;
  const tuteeBody = `
    <p style="margin:0 0 12px;">Hi ${input.tuteeName},</p>
    <p style="margin:0 0 12px;">Your request has been sent to <strong>${input.tutorName}</strong> for <strong>${input.courseName}</strong>.</p>
    <p style="margin:0 0 12px;">You will be notified as soon as the tutor responds.</p>
  `;

  await Promise.all([
    sendEmail(
      input.tutorEmail,
      "New CampusTutor session request",
      wrapEmail("New session request", tutorBody, input.actionUrl, "Review request")
    ),
    sendEmail(
      input.tuteeEmail,
      "Your CampusTutor request was sent",
      wrapEmail("Request sent", tuteeBody, `${env.FRONTEND_URL}/requests`, "View requests")
    ),
  ]);
}

type SessionStatusEmailInput = {
  tutorEmail: string;
  tutorName: string;
  tuteeEmail: string;
  tuteeName: string;
  courseName: string;
  status: "accepted" | "declined";
  slotText?: string;
  actionUrl: string;
};

export async function sendSessionStatusEmails(input: SessionStatusEmailInput) {
  if (!canSend) return;
  const statusLabel = input.status === "accepted" ? "accepted" : "declined";
  const tuteeBody = `
    <p style="margin:0 0 12px;">Hi ${input.tuteeName},</p>
    <p style="margin:0 0 12px;">${input.tutorName} has ${statusLabel} your request for <strong>${input.courseName}</strong>.</p>
    ${input.slotText ? `<p style="margin:0 0 12px;">Proposed time: ${input.slotText}</p>` : ""}
  `;
  const tutorBody = `
    <p style="margin:0 0 12px;">Hi ${input.tutorName},</p>
    <p style="margin:0 0 12px;">You ${statusLabel} the request from <strong>${input.tuteeName}</strong> for <strong>${input.courseName}</strong>.</p>
    ${input.slotText ? `<p style="margin:0 0 12px;">Session time: ${input.slotText}</p>` : ""}
  `;

  await Promise.all([
    sendEmail(
      input.tuteeEmail,
      `Your request was ${statusLabel}`,
      wrapEmail(`Request ${statusLabel}`, tuteeBody, input.actionUrl, "Open CampusTutor")
    ),
    sendEmail(
      input.tutorEmail,
      `You ${statusLabel} a request`,
      wrapEmail(`Request ${statusLabel}`, tutorBody, `${env.FRONTEND_URL}/dashboard/tutor-hub`, "Open tutor hub")
    ),
  ]);
}

type SessionDetailsEmailInput = {
  tutorEmail: string;
  tutorName: string;
  tuteeEmail: string;
  tuteeName: string;
  courseName: string;
  sessionDate: string;
  sessionTime: string;
  meetingLink?: string | null;
  locationType?: "online" | "in_person" | null;
  locationDetails?: string | null;
  actionUrl: string;
};

export async function sendSessionDetailsEmails(input: SessionDetailsEmailInput) {
  if (!canSend) return;
  const locationLine =
    input.locationType === "in_person"
      ? `<p style="margin:0 0 12px;"><strong>Location:</strong> ${input.locationDetails ?? "TBA"}</p>`
      : input.meetingLink
        ? `<p style="margin:0 0 12px;"><strong>Meeting link:</strong> ${input.meetingLink}</p>`
        : `<p style="margin:0 0 12px;"><strong>Meeting link:</strong> TBA</p>`;

  const tuteeBody = `
    <p style="margin:0 0 12px;">Hi ${input.tuteeName},</p>
    <p style="margin:0 0 12px;">Your tutor updated the session details for <strong>${input.courseName}</strong>.</p>
    <p style="margin:0 0 12px;"><strong>Date:</strong> ${input.sessionDate}</p>
    <p style="margin:0 0 12px;"><strong>Time:</strong> ${input.sessionTime}</p>
    ${locationLine}
  `;

  await sendEmail(
    input.tuteeEmail,
    "Session details updated",
    wrapEmail("Session details updated", tuteeBody, input.actionUrl, "Open session")
  );
}

type SessionCancelEmailInput = {
  tutorEmail: string;
  tutorName: string;
  tuteeEmail: string;
  tuteeName: string;
  courseName: string;
  cancelledBy: string;
  reason?: string | null;
  actionUrl: string;
};

export async function sendSessionCancelEmails(input: SessionCancelEmailInput) {
  if (!canSend) return;
  const reasonLine = input.reason
    ? `<p style="margin:0 0 12px;"><strong>Reason:</strong> ${input.reason}</p>`
    : "";
  const body = `
    <p style="margin:0 0 12px;">This session for <strong>${input.courseName}</strong> was cancelled by ${input.cancelledBy}.</p>
    ${reasonLine}
  `;

  await Promise.all([
    sendEmail(
      input.tuteeEmail,
      "Session cancelled",
      wrapEmail("Session cancelled", `<p style="margin:0 0 12px;">Hi ${input.tuteeName},</p>${body}`, input.actionUrl, "View sessions")
    ),
    sendEmail(
      input.tutorEmail,
      "Session cancelled",
      wrapEmail("Session cancelled", `<p style="margin:0 0 12px;">Hi ${input.tutorName},</p>${body}`, input.actionUrl, "View sessions")
    ),
  ]);
}
