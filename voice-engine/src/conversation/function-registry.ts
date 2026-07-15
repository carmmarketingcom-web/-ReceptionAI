// ─── Function Registry ───────────────────────────────────────────────────────
// Defines all the tools/functions available to the LLM for function calling.

import type { LLMFunction, OrganizationConfig } from "../types/index.ts";

export type FunctionHandler = (
  args: Record<string, unknown>,
  orgConfig: OrganizationConfig,
) => Promise<FunctionHandlerResult>;

export interface FunctionHandlerResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

// ─── Function Definitions ────────────────────────────────────────────────────

/**
 * Get all function definitions for the LLM tool calling API.
 */
export function getFunctionDefinitions(orgConfig: OrganizationConfig): LLMFunction[] {
  return [
    captureCustomerInfo,
    checkAvailability,
    bookAppointment,
    cancelAppointment,
    rescheduleAppointment,
    lookupCustomer,
    transferToHuman,
    answerFaq,
    sendConfirmation,
    setLanguagePreference,
  ];
}

// ─── Tool 1: Capture Customer Info ────────────────────────────────────────────

const captureCustomerInfo: LLMFunction = {
  name: "capture_customer_info",
  description: "Save customer information gathered during the conversation",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer's full name" },
      phone: { type: "string", description: "Customer's phone number" },
      email: { type: "string", description: "Customer's email address" },
      notes: { type: "string", description: "Any additional notes about the customer or their request" },
    },
    required: ["name"],
  },
};

// ─── Tool 2: Check Availability ───────────────────────────────────────────────

const checkAvailability: LLMFunction = {
  name: "check_availability",
  description: "Check available appointment slots for a service on a given date",
  parameters: {
    type: "object",
    properties: {
      service: { type: "string", description: "The requested service name" },
      date: { type: "string", description: "Date to check (YYYY-MM-DD format)" },
      duration_minutes: { type: "integer", description: "Appointment duration in minutes" },
    },
    required: ["service", "date"],
  },
};

// ─── Tool 3: Book Appointment ─────────────────────────────────────────────────

const bookAppointment: LLMFunction = {
  name: "book_appointment",
  description: "Book an appointment for a customer",
  parameters: {
    type: "object",
    properties: {
      customer_name: { type: "string", description: "Customer's full name" },
      customer_phone: { type: "string", description: "Customer's phone number" },
      customer_email: { type: "string", description: "Customer's email" },
      service: { type: "string", description: "Service name" },
      date: { type: "string", description: "Appointment date (YYYY-MM-DD)" },
      time: { type: "string", description: "Appointment time (HH:MM)" },
      notes: { type: "string", description: "Any special notes or instructions" },
    },
    required: ["customer_name", "customer_phone", "service", "date", "time"],
  },
};

// ─── Tool 4: Cancel Appointment ───────────────────────────────────────────────

const cancelAppointment: LLMFunction = {
  name: "cancel_appointment",
  description: "Cancel an existing appointment",
  parameters: {
    type: "object",
    properties: {
      appointment_id: { type: "string", description: "ID of the appointment to cancel" },
      customer_phone: { type: "string", description: "Customer's phone number for verification" },
      reason: { type: "string", description: "Reason for cancellation" },
    },
    required: ["appointment_id"],
  },
};

// ─── Tool 5: Reschedule Appointment ───────────────────────────────────────────

const rescheduleAppointment: LLMFunction = {
  name: "reschedule_appointment",
  description: "Reschedule an existing appointment to a new time",
  parameters: {
    type: "object",
    properties: {
      appointment_id: { type: "string", description: "ID of the appointment to reschedule" },
      new_date: { type: "string", description: "New date (YYYY-MM-DD)" },
      new_time: { type: "string", description: "New time (HH:MM)" },
      reason: { type: "string", description: "Reason for rescheduling" },
    },
    required: ["appointment_id", "new_date", "new_time"],
  },
};

// ─── Tool 6: Lookup Customer ─────────────────────────────────────────────────

const lookupCustomer: LLMFunction = {
  name: "lookup_customer",
  description: "Look up a customer by phone number or email to find their existing appointments",
  parameters: {
    type: "object",
    properties: {
      phone: { type: "string", description: "Customer's phone number" },
      email: { type: "string", description: "Customer's email address" },
    },
    required: [],
  },
};

// ─── Tool 7: Transfer to Human ────────────────────────────────────────────────

const transferToHuman: LLMFunction = {
  name: "transfer_to_human",
  description: "Transfer the customer to a human team member",
  parameters: {
    type: "object",
    properties: {
      reason: { type: "string", description: "Reason for the transfer" },
      urgency: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Urgency of the transfer",
      },
      summary: {
        type: "string",
        description: "Brief summary of the conversation so far for the human",
      },
    },
    required: ["reason", "summary"],
  },
};

// ─── Tool 8: Answer FAQ ───────────────────────────────────────────────────────

const answerFaq: LLMFunction = {
  name: "answer_faq",
  description: "Look up an answer from the business FAQ/knowledge base",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The customer's question to search in the knowledge base" },
    },
    required: ["query"],
  },
};

// ─── Tool 9: Send Confirmation ────────────────────────────────────────────────

const sendConfirmation: LLMFunction = {
  name: "send_confirmation",
  description: "Send an appointment confirmation message to the customer via their preferred channel",
  parameters: {
    type: "object",
    properties: {
      appointment_id: { type: "string", description: "ID of the confirmed appointment" },
      channel: { type: "string", enum: ["sms", "email"], description: "Channel to send confirmation via" },
    },
    required: ["appointment_id", "channel"],
  },
};

// ─── Tool 10: Set Language Preference ─────────────────────────────────────────

const setLanguagePreference: LLMFunction = {
  name: "set_language_preference",
  description: "Set or change the language preference for this conversation",
  parameters: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["en", "es"],
        description: "Language code (en = English, es = Spanish)",
      },
    },
    required: ["language"],
  },
};

// ─── Function Handler Mappings ────────────────────────────────────────────────

/**
 * Map of function names to their handler implementations.
 * These are called after the LLM requests a function execution.
 */
export const functionHandlers: Record<string, FunctionHandler> = {
  capture_customer_info: async (args, orgConfig) => {
    // In a real implementation, save to PostgreSQL
    console.log(`[${orgConfig.name}] Captured customer info:`, args);
    return {
      success: true,
      data: args,
      message: "Customer information recorded.",
    };
  },

  check_availability: async (args, orgConfig) => {
    // In a real implementation, query the calendar/DB for available slots
    const date = args.date as string;
    const service = args.service as string;
    console.log(`[${orgConfig.name}] Checking availability for ${service} on ${date}`);

    // Mock: return some available times
    const mockSlots = [
      { time: "09:00", available: true },
      { time: "10:00", available: true },
      { time: "11:00", available: true },
      { time: "14:00", available: true },
      { time: "15:00", available: true },
    ];

    return {
      success: true,
      data: { service, date, availableSlots: mockSlots },
    };
  },

  book_appointment: async (args, orgConfig) => {
    // In a real implementation, create an appointment in the DB and calendar
    console.log(`[${orgConfig.name}] Booking appointment:`, args);
    return {
      success: true,
      data: {
        appointmentId: crypto.randomUUID(),
        ...args,
        status: "confirmed",
      },
      message: "Appointment booked successfully.",
    };
  },

  cancel_appointment: async (args, orgConfig) => {
    console.log(`[${orgConfig.name}] Cancelling appointment:`, args);
    return {
      success: true,
      data: args,
      message: "Appointment cancelled.",
    };
  },

  reschedule_appointment: async (args, orgConfig) => {
    console.log(`[${orgConfig.name}] Rescheduling appointment:`, args);
    return {
      success: true,
      data: args,
      message: "Appointment rescheduled.",
    };
  },

  lookup_customer: async (args, orgConfig) => {
    console.log(`[${orgConfig.name}] Looking up customer:`, args);
    // Mock: return no existing appointments
    return {
      success: true,
      data: { customer: null, appointments: [] },
    };
  },

  transfer_to_human: async (args, orgConfig) => {
    console.log(`[${orgConfig.name}] Transfer to human requested:`, args);
    return {
      success: true,
      data: {
        reason: args.reason,
        urgency: args.urgency,
        summary: args.summary,
        escalationPhone: orgConfig.escalationPhone,
      },
      message: "Transfer initiated. Customer will be connected to a team member.",
    };
  },

  answer_faq: async (args, orgConfig) => {
    const query = (args.query as string || "").toLowerCase();
    console.log(`[${orgConfig.name}] FAQ lookup: ${query}`);

    // Search org FAQ entries for a match
    const match = orgConfig.faqEntries.find(
      (f) =>
        f.question.toLowerCase().includes(query) ||
        query.includes(f.question.toLowerCase()),
    );

    if (match) {
      return {
        success: true,
        data: { question: match.question, answer: match.answer },
      };
    }

    return {
      success: false,
      data: null,
      error: "No matching FAQ entry found.",
    };
  },

  send_confirmation: async (args, orgConfig) => {
    console.log(`[${orgConfig.name}] Sending confirmation:`, args);
    return {
      success: true,
      data: args,
      message: "Confirmation sent.",
    };
  },

  set_language_preference: async (args, orgConfig) => {
    const lang = args.language as string;
    console.log(`[${orgConfig.name}] Language set to: ${lang}`);
    return {
      success: true,
      data: { language: lang },
      message: `Language set to ${lang === "es" ? "Spanish" : "English"}.`,
    };
  },
};