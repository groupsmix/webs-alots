/**
 * Post-Appointment Feedback Flow
 *
 * After an appointment is completed, sends a WhatsApp message to the patient
 * with quick-reply rating buttons (1-5 stars). Based on the rating:
 * - 4-5 stars: sends Google Review link
 * - 1-3 stars: captures feedback privately, notifies clinic admin
 */

import { sendInteractiveMessage, sendTextMessage } from "@/lib/whatsapp";
import { dispatchNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

interface FeedbackFlowParams {
  appointmentId: string;
  clinicId: string;
  clinicName: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  googlePlaceId?: string | null;
}

/**
 * Send a post-appointment feedback request via WhatsApp.
 * Uses interactive quick-reply buttons for rating (limited to 3 buttons
 * per WhatsApp API constraints, so we use: Poor/Good/Excellent).
 */
export async function sendFeedbackRequest(params: FeedbackFlowParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const { patientName, patientPhone, clinicName, doctorName } = params;

  try {
    const result = await sendInteractiveMessage({
      to: patientPhone,
      header: `Rate Your Visit - ${clinicName}`,
      body: `Hello ${patientName}, thank you for visiting ${clinicName} today with Dr. ${doctorName}.\n\nHow was your experience? Your feedback helps us improve!`,
      buttons: [
        { id: "RATING_1_3", title: "Could Be Better" },
        { id: "RATING_4", title: "Good" },
        { id: "RATING_5", title: "Excellent!" },
      ],
      footer: "Tap to rate your experience",
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (err) {
    logger.error("Failed to send feedback request", {
      context: "post-appointment-feedback",
      error: err,
    });
    return { success: false, error: String(err) };
  }
}

/**
 * Handle a rating response from a patient.
 * - Rating 4-5: send Google Review link
 * - Rating 1-3: capture privately, notify admin
 */
export async function handleFeedbackResponse(params: {
  clinicId: string;
  clinicName: string;
  patientPhone: string;
  patientName: string;
  patientId: string;
  rating: number;
  googlePlaceId?: string | null;
  adminUserId?: string | null;
}): Promise<void> {
  const { clinicName, patientPhone, patientName, rating, googlePlaceId, adminUserId } = params;

  if (rating >= 4 && googlePlaceId) {
    // Positive rating — send Google Review link
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${googlePlaceId}`;
    await sendTextMessage(
      patientPhone,
      `Thank you for the great rating, ${patientName}! 🙏\n\n` +
      `We'd love it if you could share your experience on Google to help others find us:\n${reviewUrl}\n\n` +
      `— ${clinicName}`,
    );
  } else if (rating >= 4) {
    // Positive but no Google Place ID configured
    await sendTextMessage(
      patientPhone,
      `Thank you for the great feedback, ${patientName}! We're glad you had a good experience at ${clinicName}. 🙏`,
    );
  } else {
    // Low rating — thank them privately, ask for details
    await sendTextMessage(
      patientPhone,
      `Thank you for your feedback, ${patientName}. We're sorry your experience wasn't perfect.\n\n` +
      `Your feedback is important to us and has been shared with our team. ` +
      `If you'd like to share more details, please reply to this message.\n\n— ${clinicName}`,
    );

    // Notify clinic admin about the low rating
    if (adminUserId) {
      await dispatchNotification(
        "new_review",
        {
          patient_name: patientName,
          review_stars: String(rating),
          review_comment: `Low rating received via WhatsApp feedback (${rating}/5)`,
          clinic_name: clinicName,
        },
        adminUserId,
        ["in_app"],
      );
    }
  }
}

/**
 * Map WhatsApp button reply IDs to numeric ratings.
 */
export function parseRatingFromButtonId(buttonId: string): number | null {
  switch (buttonId) {
    case "RATING_1_3":
      return 2; // Represents 1-3 range, stored as 2
    case "RATING_4":
      return 4;
    case "RATING_5":
      return 5;
    default:
      return null;
  }
}
