// Auto-generated types from Supabase schema
// Run: npx supabase gen types typescript --local > src/types/supabase.ts
// to regenerate after migrations

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          email: string;
          phone: string | null;
          address: string | null;
          timezone: string;
          opening_hours: Json;
          stripe_account_id: string | null;
          stripe_subscription_id: string | null;
          seat_count: number;
          ai_name: string | null;
          ai_tone: string | null;
          ai_languages: string[];
          cancellation_delay_minutes: number | null;
          voice_enabled: boolean;
          auto_confirm_bookings: boolean;
          telnyx_phone_number: string | null;
          google_place_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          email: string;
          phone?: string | null;
          address?: string | null;
          timezone?: string;
          opening_hours?: Json;
          stripe_account_id?: string | null;
          stripe_subscription_id?: string | null;
          seat_count?: number;
          ai_name?: string | null;
          ai_tone?: string | null;
          ai_languages?: string[];
          cancellation_delay_minutes?: number | null;
          voice_enabled?: boolean;
          auto_confirm_bookings?: boolean;
          telnyx_phone_number?: string | null;
          google_place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          email?: string;
          phone?: string | null;
          address?: string | null;
          timezone?: string;
          opening_hours?: Json;
          stripe_account_id?: string | null;
          stripe_subscription_id?: string | null;
          seat_count?: number;
          ai_name?: string | null;
          ai_tone?: string | null;
          ai_languages?: string[];
          cancellation_delay_minutes?: number | null;
          voice_enabled?: boolean;
          auto_confirm_bookings?: boolean;
          telnyx_phone_number?: string | null;
          google_place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practitioners: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          email: string | null;
          color: string;
          specialties: string[];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          email?: string | null;
          color: string;
          specialties: string[];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          email?: string | null;
          color?: string;
          specialties?: string[];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practitioners_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      practitioner_availability: {
        Row: {
          id: string;
          merchant_id: string;
          practitioner_id: string;
          day_of_week: number | null;
          start_time: string;
          end_time: string;
          is_available: boolean;
          exception_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          practitioner_id: string;
          day_of_week?: number | null;
          start_time: string;
          end_time: string;
          is_available: boolean;
          exception_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          practitioner_id?: string;
          day_of_week?: number | null;
          start_time?: string;
          end_time?: string;
          is_available?: boolean;
          exception_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practitioner_availability_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practitioner_availability_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      practitioner_services: {
        Row: {
          practitioner_id: string;
          service_id: string;
          merchant_id: string;
        };
        Insert: {
          practitioner_id: string;
          service_id: string;
          merchant_id: string;
        };
        Update: {
          practitioner_id?: string;
          service_id?: string;
          merchant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practitioner_services_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practitioner_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practitioner_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          merchant_id: string;
          name: string | null;
          phone: string | null;
          email: string | null;
          whatsapp_id: string | null;
          messenger_id: string | null;
          telegram_id: string | null;
          preferred_practitioner_id: string | null;
          preferred_service_id: string | null;
          preferred_language: string;
          loyalty_points: number;
          loyalty_tier: string;
          no_show_count: number;
          is_blocked: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          whatsapp_id?: string | null;
          messenger_id?: string | null;
          telegram_id?: string | null;
          preferred_practitioner_id?: string | null;
          preferred_service_id?: string | null;
          preferred_language?: string;
          loyalty_points?: number;
          loyalty_tier?: string;
          no_show_count?: number;
          is_blocked?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          whatsapp_id?: string | null;
          messenger_id?: string | null;
          telegram_id?: string | null;
          preferred_practitioner_id?: string | null;
          preferred_service_id?: string | null;
          preferred_language?: string;
          loyalty_points?: number;
          loyalty_tier?: string;
          no_show_count?: number;
          is_blocked?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          merchant_id: string;
          client_id: string;
          practitioner_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
          source_channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice" | "dashboard" | "booking_page";
          cancelled_at: string | null;
          cancelled_by: "client" | "merchant" | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          client_id: string;
          practitioner_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
          source_channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice" | "dashboard" | "booking_page";
          cancelled_at?: string | null;
          cancelled_by?: "client" | "merchant" | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          client_id?: string;
          practitioner_id?: string;
          service_id?: string;
          starts_at?: string;
          ends_at?: string;
          status?: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
          source_channel?: "whatsapp" | "messenger" | "telegram" | "sms" | "voice" | "dashboard" | "booking_page";
          cancelled_at?: string | null;
          cancelled_by?: "client" | "merchant" | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          merchant_id: string;
          client_id: string;
          channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          client_id: string;
          channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          client_id?: string;
          channel?: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          merchant_id: string;
          conversation_id: string;
          sender: "client" | "ai";
          content: string;
          is_voice_transcription: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          conversation_id: string;
          sender: "client" | "ai";
          content: string;
          is_voice_transcription?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          conversation_id?: string;
          sender?: "client" | "ai";
          content?: string;
          is_voice_transcription?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          merchant_id: string;
          client_id: string;
          booking_id: string | null;
          type:
            | "reminder_24h"
            | "reminder_1h"
            | "confirmation"
            | "cancellation"
            | "no_show"
            | "review_request"
            | "loyalty_upgrade"
            | "package_expiring";
          channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          status: "pending" | "sent" | "failed";
          scheduled_at: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          client_id: string;
          booking_id?: string | null;
          type:
            | "reminder_24h"
            | "reminder_1h"
            | "confirmation"
            | "cancellation"
            | "no_show"
            | "review_request"
            | "loyalty_upgrade"
            | "package_expiring";
          channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          status?: "pending" | "sent" | "failed";
          scheduled_at: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          client_id?: string;
          booking_id?: string | null;
          type?:
            | "reminder_24h"
            | "reminder_1h"
            | "confirmation"
            | "cancellation"
            | "no_show"
            | "review_request"
            | "loyalty_upgrade"
            | "package_expiring";
          channel?: "whatsapp" | "messenger" | "telegram" | "sms" | "voice";
          status?: "pending" | "sent" | "failed";
          scheduled_at?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      tips: {
        Row: {
          id: string;
          merchant_id: string;
          booking_id: string | null;
          client_id: string;
          practitioner_id: string;
          amount_cents: number;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          booking_id?: string | null;
          client_id: string;
          practitioner_id: string;
          amount_cents: number;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          booking_id?: string | null;
          client_id?: string;
          practitioner_id?: string;
          amount_cents?: number;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tips_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tips_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tips_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      packages: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          service_id: string;
          total_uses: number;
          price_cents: number;
          validity_days: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          service_id: string;
          total_uses: number;
          price_cents: number;
          validity_days?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          service_id?: string;
          total_uses?: number;
          price_cents?: number;
          validity_days?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packages_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      client_packages: {
        Row: {
          id: string;
          merchant_id: string;
          client_id: string;
          package_id: string;
          remaining_uses: number;
          purchased_at: string;
          expires_at: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          client_id: string;
          package_id: string;
          remaining_uses: number;
          purchased_at?: string;
          expires_at?: string | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          client_id?: string;
          package_id?: string;
          remaining_uses?: number;
          purchased_at?: string;
          expires_at?: string | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_packages_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_packages_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_packages_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
        ];
      };
      client_subscriptions: {
        Row: {
          id: string;
          merchant_id: string;
          client_id: string;
          service_id: string;
          name: string;
          price_cents: number;
          stripe_subscription_id: string;
          status: "active" | "cancelled" | "past_due";
          current_period_uses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          client_id: string;
          service_id: string;
          name: string;
          price_cents: number;
          stripe_subscription_id: string;
          status?: "active" | "cancelled" | "past_due";
          current_period_uses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          client_id?: string;
          service_id?: string;
          name?: string;
          price_cents?: number;
          stripe_subscription_id?: string;
          status?: "active" | "cancelled" | "past_due";
          current_period_uses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_subscriptions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_programs: {
        Row: {
          id: string;
          merchant_id: string;
          points_per_visit: number;
          points_per_euro: number;
          silver_threshold: number;
          gold_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          points_per_visit?: number;
          points_per_euro?: number;
          silver_threshold?: number;
          gold_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          points_per_visit?: number;
          points_per_euro?: number;
          silver_threshold?: number;
          gold_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: true;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id: string;
          type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      tips_by_practitioner: {
        Row: {
          practitioner_id: string;
          merchant_id: string;
          total_cents: number;
          tip_count: number;
        };
        Relationships: [];
      };
      booking_stats: {
        Row: {
          merchant_id: string;
          total_bookings: number;
          completed: number;
          no_shows: number;
          cancelled: number;
          revenue_cents: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Merchant = Tables<"merchants">;
export type Practitioner = Tables<"practitioners">;
export type Service = Tables<"services">;
export type Client = Tables<"clients">;
export type Booking = Tables<"bookings">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type Notification = Tables<"notifications">;
export type Tip = Tables<"tips">;
export type Package = Tables<"packages">;
export type ClientPackage = Tables<"client_packages">;
export type ClientSubscription = Tables<"client_subscriptions">;
export type LoyaltyProgram = Tables<"loyalty_programs">;

export type BookingStatus = Booking["status"];
export type SourceChannel = Booking["source_channel"];
export type MessageChannel = Conversation["channel"];
export type NotificationType = Notification["type"];
export type LoyaltyTier = "bronze" | "silver" | "gold";
