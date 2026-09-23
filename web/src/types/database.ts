// Hand-written to match supabase/migrations/*.sql exactly.
// Once a real Supabase project exists, regenerate and reconcile with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// (keep the doc comments above each table when you do — they don't survive codegen)
//
// Insert/Update are written out per-table as plain object literals (not derived through a
// shared generic helper like `Partial<Row> & Pick<Row, K>`). That indirection breaks
// postgrest-js's `Relation['Update']` conditional-type resolution on a second, independent
// .from(table) call elsewhere in the same file — every mutation silently typechecks against
// `never` instead of the real Update type. Codegen output never has this problem because it
// always writes each table's Insert/Update out in full, so we match that shape by hand too.

export type AppRole = "customer" | "admin";
export type InquiryStatus = "new" | "contacted" | "closed";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cod" | "online";
export type TransactionStatus = "created" | "pending" | "success" | "failed" | "refunded";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type PaymentMode = "disabled" | "simulated" | "live";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          pin_code: string | null;
          role: AppRole;
          must_change_password: boolean;
          current_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pin_code?: string | null;
          role?: AppRole;
          must_change_password?: boolean;
          current_session_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pin_code?: string | null;
          role?: AppRole;
          must_change_password?: boolean;
          current_session_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      login_lockouts: {
        Row: {
          email: string;
          failed_login_attempts: number;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          email: string;
          failed_login_attempts?: number;
          locked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          email?: string;
          failed_login_attempts?: number;
          locked_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      rate_limits: {
        Row: {
          client_key: string;
          policy: string;
          window_start: string;
          request_count: number;
        };
        Insert: {
          client_key: string;
          policy: string;
          window_start?: string;
          request_count?: number;
        };
        Update: {
          client_key?: string;
          policy?: string;
          window_start?: string;
          request_count?: number;
        };
        Relationships: [];
      };

      categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          image_url: string | null;
          display_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          image_url?: string | null;
          display_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          display_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };

      products: {
        Row: {
          id: number;
          name: string;
          category_id: number;
          wood_type: string | null;
          description: string | null;
          price: number;
          old_price: number | null;
          dimensions: string | null;
          image_url: string | null;
          stock_quantity: number;
          is_available: boolean;
          is_featured: boolean;
          is_custom_order: boolean;
          created_at: string;
          average_rating: number;
          review_count: number;
        };
        Insert: {
          id?: number;
          name: string;
          category_id: number;
          wood_type?: string | null;
          description?: string | null;
          price?: number;
          old_price?: number | null;
          dimensions?: string | null;
          image_url?: string | null;
          stock_quantity?: number;
          is_available?: boolean;
          is_featured?: boolean;
          is_custom_order?: boolean;
          created_at?: string;
          average_rating?: number;
          review_count?: number;
        };
        Update: {
          id?: number;
          name?: string;
          category_id?: number;
          wood_type?: string | null;
          description?: string | null;
          price?: number;
          old_price?: number | null;
          dimensions?: string | null;
          image_url?: string | null;
          stock_quantity?: number;
          is_available?: boolean;
          is_featured?: boolean;
          is_custom_order?: boolean;
          created_at?: string;
          average_rating?: number;
          review_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };

      product_images: {
        Row: {
          id: number;
          product_id: number;
          image_path: string;
          alt_text: string | null;
          display_order: number;
        };
        Insert: {
          id?: number;
          product_id: number;
          image_path: string;
          alt_text?: string | null;
          display_order?: number;
        };
        Update: {
          id?: number;
          product_id?: number;
          image_path?: string;
          alt_text?: string | null;
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      inquiries: {
        Row: {
          id: number;
          name: string;
          phone: string;
          email: string | null;
          product_id: number | null;
          message: string;
          status: InquiryStatus;
          admin_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          phone: string;
          email?: string | null;
          product_id?: number | null;
          message: string;
          status?: InquiryStatus;
          admin_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          phone?: string;
          email?: string | null;
          product_id?: number | null;
          message?: string;
          status?: InquiryStatus;
          admin_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      orders: {
        Row: {
          id: number;
          order_number: string;
          user_id: string;
          order_date: string;
          shipping_name: string;
          shipping_phone: string;
          shipping_address: string;
          shipping_city: string;
          shipping_state: string;
          shipping_pin_code: string;
          notes: string | null;
          sub_total: number;
          shipping_charge: number;
          total_amount: number;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          order_status: OrderStatus;
          payment_reference: string | null;
          tracking_number: string | null;
          shipped_date: string | null;
          delivered_date: string | null;
        };
        Insert: {
          id?: number;
          order_number: string;
          user_id: string;
          order_date?: string;
          shipping_name: string;
          shipping_phone: string;
          shipping_address: string;
          shipping_city: string;
          shipping_state: string;
          shipping_pin_code: string;
          notes?: string | null;
          sub_total?: number;
          shipping_charge?: number;
          total_amount?: number;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          order_status?: OrderStatus;
          payment_reference?: string | null;
          tracking_number?: string | null;
          shipped_date?: string | null;
          delivered_date?: string | null;
        };
        Update: {
          id?: number;
          order_number?: string;
          user_id?: string;
          order_date?: string;
          shipping_name?: string;
          shipping_phone?: string;
          shipping_address?: string;
          shipping_city?: string;
          shipping_state?: string;
          shipping_pin_code?: string;
          notes?: string | null;
          sub_total?: number;
          shipping_charge?: number;
          total_amount?: number;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          order_status?: OrderStatus;
          payment_reference?: string | null;
          tracking_number?: string | null;
          shipped_date?: string | null;
          delivered_date?: string | null;
        };
        Relationships: [];
      };

      order_items: {
        Row: {
          id: number;
          order_id: number;
          product_id: number;
          product_name: string;
          unit_price: number;
          quantity: number;
        };
        Insert: {
          id?: number;
          order_id: number;
          product_id: number;
          product_name: string;
          unit_price: number;
          quantity: number;
        };
        Update: {
          id?: number;
          order_id?: number;
          product_id?: number;
          product_name?: string;
          unit_price?: number;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      cart_items: {
        Row: {
          id: number;
          cart_key: string;
          product_id: number;
          quantity: number;
          added_at: string;
        };
        Insert: {
          id?: number;
          cart_key: string;
          product_id: number;
          quantity: number;
          added_at?: string;
        };
        Update: {
          id?: number;
          cart_key?: string;
          product_id?: number;
          quantity?: number;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      reviews: {
        Row: {
          id: number;
          product_id: number;
          user_id: string;
          author_name: string;
          rating: number;
          title: string | null;
          comment: string;
          is_verified_purchase: boolean;
          status: ReviewStatus;
          helpful_count: number;
          created_at: string;
          moderated_at: string | null;
          admin_response: string | null;
        };
        Insert: {
          id?: number;
          product_id: number;
          user_id: string;
          author_name: string;
          rating: number;
          title?: string | null;
          comment: string;
          is_verified_purchase?: boolean;
          status?: ReviewStatus;
          helpful_count?: number;
          created_at?: string;
          moderated_at?: string | null;
          admin_response?: string | null;
        };
        Update: {
          id?: number;
          product_id?: number;
          user_id?: string;
          author_name?: string;
          rating?: number;
          title?: string | null;
          comment?: string;
          is_verified_purchase?: boolean;
          status?: ReviewStatus;
          helpful_count?: number;
          created_at?: string;
          moderated_at?: string | null;
          admin_response?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      review_votes: {
        Row: { id: number; review_id: number; user_id: string; created_at: string };
        Insert: { id?: number; review_id: number; user_id: string; created_at?: string };
        Update: { id?: number; review_id?: number; user_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          }
        ];
      };

      site_feedback: {
        Row: {
          id: number;
          user_id: string;
          author_name: string;
          rating: number;
          comment: string;
          from_welcome_prompt: boolean;
          created_at: string;
          admin_response: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          author_name: string;
          rating: number;
          comment: string;
          from_welcome_prompt?: boolean;
          created_at?: string;
          admin_response?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          author_name?: string;
          rating?: number;
          comment?: string;
          from_welcome_prompt?: boolean;
          created_at?: string;
          admin_response?: string | null;
        };
        Relationships: [];
      };

      payment_transactions: {
        Row: {
          id: number;
          order_id: number;
          payment_request_id: string | null;
          payment_id: string | null;
          amount: number;
          currency: string;
          status: TransactionStatus;
          payment_method: string | null;
          failure_reason: string | null;
          payment_url: string | null;
          is_webhook_verified: boolean;
          gateway_response: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: number;
          order_id: number;
          payment_request_id?: string | null;
          payment_id?: string | null;
          amount?: number;
          currency?: string;
          status?: TransactionStatus;
          payment_method?: string | null;
          failure_reason?: string | null;
          payment_url?: string | null;
          is_webhook_verified?: boolean;
          gateway_response?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: number;
          order_id?: number;
          payment_request_id?: string | null;
          payment_id?: string | null;
          amount?: number;
          currency?: string;
          status?: TransactionStatus;
          payment_method?: string | null;
          failure_reason?: string | null;
          payment_url?: string | null;
          is_webhook_verified?: boolean;
          gateway_response?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };

      admin_login_otps: {
        Row: {
          id: number;
          public_token: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          is_used: boolean;
          failed_attempts: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          public_token?: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          is_used?: boolean;
          failed_attempts?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          public_token?: string;
          user_id?: string;
          code_hash?: string;
          expires_at?: string;
          is_used?: boolean;
          failed_attempts?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      visitor_logs: {
        Row: {
          id: number;
          ip_address: string;
          city: string | null;
          region: string | null;
          country: string | null;
          country_code: string | null;
          user_agent: string | null;
          landing_page: string | null;
          referrer: string | null;
          first_seen: string;
          last_seen: string;
          page_views: number;
        };
        Insert: {
          id?: number;
          ip_address: string;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          country_code?: string | null;
          user_agent?: string | null;
          landing_page?: string | null;
          referrer?: string | null;
          first_seen?: string;
          last_seen?: string;
          page_views?: number;
        };
        Update: {
          id?: number;
          ip_address?: string;
          city?: string | null;
          region?: string | null;
          country?: string | null;
          country_code?: string | null;
          user_agent?: string | null;
          landing_page?: string | null;
          referrer?: string | null;
          first_seen?: string;
          last_seen?: string;
          page_views?: number;
        };
        Relationships: [];
      };

      visitor_counter: {
        Row: {
          id: number;
          total_visits: number;
          total_page_views: number;
          last_updated: string;
        };
        Insert: {
          id?: number;
          total_visits?: number;
          total_page_views?: number;
          last_updated?: string;
        };
        Update: {
          id?: number;
          total_visits?: number;
          total_page_views?: number;
          last_updated?: string;
        };
        Relationships: [];
      };

      site_settings: {
        Row: {
          id: number;
          shop_name: string;
          tagline: string;
          phone: string;
          whatsapp_number: string;
          email: string;
          address_line1: string;
          address_line2: string;
          working_hours: string;
          map_embed_url: string;
          site_base_url: string;
          gst_number: string;
          gst_rate: number;
          prices_include_gst: boolean;
          state_name: string;
          state_code: string;
          pan_number: string;
          bank_name: string;
          bank_account_number: string;
          bank_ifsc: string;
          upi_id: string;
          invoice_prefix: string;
          shipping_charge: number;
          free_shipping_above: number;
          cashfree_mode: PaymentMode;
          cashfree_client_id: string;
          cashfree_client_secret: string;
          cashfree_base_url: string;
          cashfree_api_version: string;
          gemini_enabled: boolean;
          gemini_api_key: string;
          gemini_model: string;
          feature_reviews: boolean;
          feature_moderate_reviews: boolean;
          feature_require_purchase_to_review: boolean;
          feature_visitor_counter: boolean;
          feature_geolocation: boolean;
          feature_pwa: boolean;
        };
        Insert: {
          id?: number;
          shop_name?: string;
          tagline?: string;
          phone?: string;
          whatsapp_number?: string;
          email?: string;
          address_line1?: string;
          address_line2?: string;
          working_hours?: string;
          map_embed_url?: string;
          site_base_url?: string;
          gst_number?: string;
          gst_rate?: number;
          prices_include_gst?: boolean;
          state_name?: string;
          state_code?: string;
          pan_number?: string;
          bank_name?: string;
          bank_account_number?: string;
          bank_ifsc?: string;
          upi_id?: string;
          invoice_prefix?: string;
          shipping_charge?: number;
          free_shipping_above?: number;
          cashfree_mode?: PaymentMode;
          cashfree_client_id?: string;
          cashfree_client_secret?: string;
          cashfree_base_url?: string;
          cashfree_api_version?: string;
          gemini_enabled?: boolean;
          gemini_api_key?: string;
          gemini_model?: string;
          feature_reviews?: boolean;
          feature_moderate_reviews?: boolean;
          feature_require_purchase_to_review?: boolean;
          feature_visitor_counter?: boolean;
          feature_geolocation?: boolean;
          feature_pwa?: boolean;
        };
        Update: {
          id?: number;
          shop_name?: string;
          tagline?: string;
          phone?: string;
          whatsapp_number?: string;
          email?: string;
          address_line1?: string;
          address_line2?: string;
          working_hours?: string;
          map_embed_url?: string;
          site_base_url?: string;
          gst_number?: string;
          gst_rate?: number;
          prices_include_gst?: boolean;
          state_name?: string;
          state_code?: string;
          pan_number?: string;
          bank_name?: string;
          bank_account_number?: string;
          bank_ifsc?: string;
          upi_id?: string;
          invoice_prefix?: string;
          shipping_charge?: number;
          free_shipping_above?: number;
          cashfree_mode?: PaymentMode;
          cashfree_client_id?: string;
          cashfree_client_secret?: string;
          cashfree_base_url?: string;
          cashfree_api_version?: string;
          gemini_enabled?: boolean;
          gemini_api_key?: string;
          gemini_model?: string;
          feature_reviews?: boolean;
          feature_moderate_reviews?: boolean;
          feature_require_purchase_to_review?: boolean;
          feature_visitor_counter?: boolean;
          feature_geolocation?: boolean;
          feature_pwa?: boolean;
        };
        Relationships: [];
      };
    };

    Views: {
      site_settings_public: {
        Row: {
          shop_name: string;
          tagline: string;
          phone: string;
          whatsapp_number: string;
          email: string;
          address_line1: string;
          address_line2: string;
          working_hours: string;
          map_embed_url: string;
          gst_number: string;
          gst_rate: number;
          prices_include_gst: boolean;
          state_name: string;
          state_code: string;
          invoice_prefix: string;
          shipping_charge: number;
          free_shipping_above: number;
          feature_reviews: boolean;
          feature_moderate_reviews: boolean;
          feature_require_purchase_to_review: boolean;
          feature_visitor_counter: boolean;
          feature_geolocation: boolean;
          feature_pwa: boolean;
        };
        Relationships: [];
      };
    };

    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      place_order: {
        Args: {
          p_user_id: string;
          p_cart_key: string;
          p_shipping_name: string;
          p_shipping_phone: string;
          p_shipping_address: string;
          p_shipping_city: string;
          p_shipping_state: string;
          p_shipping_pin_code: string;
          p_notes: string | null;
          p_payment_method: PaymentMethod;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      check_rate_limit: {
        Args: {
          p_client_key: string;
          p_policy: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: { allowed: boolean; remaining: number; retry_after_seconds: number }[];
      };
      cleanup_rate_limits: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
}
