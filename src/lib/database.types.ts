
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "alert_snoozes": {
                  Row: {
                    "created_at": string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"until": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"until": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"until"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_snoozes_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "alert_snoozes_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "builtin_key": string | null,"created_at": string,"default_attributes": NonNullable<Json>,"icon": string,"id": string,"name": string,"name_en": string | null,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "builtin_key"?: string | null,"created_at"?: string,"default_attributes"?: NonNullable<Json>,"icon"?: string,"id"?: string,"name": string,"name_en"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "builtin_key"?: string | null,"created_at"?: string,"default_attributes"?: NonNullable<Json>,"icon"?: string,"id"?: string,"name"?: string,"name_en"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"item_events": {
                  Row: {
                    "created_at": string,"delta": number | null,"from_condition": Database["public"]['Enums']["item_condition"] | null,"from_location_id": string | null,"id": string,"item_id": string,"note": string | null,"quantity_after": number | null,"to_condition": Database["public"]['Enums']["item_condition"] | null,"to_location_id": string | null,"type": Database["public"]['Enums']["item_event_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delta"?: number | null,"from_condition"?: Database["public"]['Enums']["item_condition"] | null,"from_location_id"?: string | null,"id"?: string,"item_id": string,"note"?: string | null,"quantity_after"?: number | null,"to_condition"?: Database["public"]['Enums']["item_condition"] | null,"to_location_id"?: string | null,"type": Database["public"]['Enums']["item_event_type"],"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"delta"?: number | null,"from_condition"?: Database["public"]['Enums']["item_condition"] | null,"from_location_id"?: string | null,"id"?: string,"item_id"?: string,"note"?: string | null,"quantity_after"?: number | null,"to_condition"?: Database["public"]['Enums']["item_condition"] | null,"to_location_id"?: string | null,"type"?: Database["public"]['Enums']["item_event_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_events_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "item_events_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"item_photos": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string,"sort_order": number,"storage_path": string,"thumb_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id": string,"sort_order"?: number,"storage_path": string,"thumb_path"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string,"sort_order"?: number,"storage_path"?: string,"thumb_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_photos_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "item_photos_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"item_tags": {
                  Row: {
                    "item_id": string,"tag_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"tag_id": string,"user_id"?: string
                  }
                  Update: {
                    "item_id"?: string,"tag_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_tags_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "item_tags_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "item_tags_tag_id_user_id_fkey"
      columns: ["tag_id","user_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"items": {
                  Row: {
                    "archived_at": string | null,"attributes": NonNullable<Json>,"barcode": string | null,"category_id": string | null,"condition": Database["public"]['Enums']["item_condition"],"created_at": string,"expiry_date": string | null,"id": string,"last_replaced_at": string | null,"location_id": string | null,"min_quantity": number | null,"name": string,"name_norm": string | null,"notes": string | null,"opened_date": string | null,"purchase_date": string | null,"purchase_place": string | null,"purchase_price": number | null,"quantity": number,"replace_after_months": number | null,"search_text": string,"search_vector": unknown,"unit": string | null,"updated_at": string,"user_id": string,"warranty_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"attributes"?: NonNullable<Json>,"barcode"?: string | null,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"last_replaced_at"?: string | null,"location_id"?: string | null,"min_quantity"?: number | null,"name": string,"name_norm"?: never,"notes"?: string | null,"opened_date"?: string | null,"purchase_date"?: string | null,"purchase_place"?: string | null,"purchase_price"?: number | null,"quantity"?: number,"replace_after_months"?: number | null,"search_text"?: string,"search_vector"?: unknown,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"warranty_until"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"attributes"?: NonNullable<Json>,"barcode"?: string | null,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"expiry_date"?: string | null,"id"?: string,"last_replaced_at"?: string | null,"location_id"?: string | null,"min_quantity"?: number | null,"name"?: string,"name_norm"?: never,"notes"?: string | null,"opened_date"?: string | null,"purchase_date"?: string | null,"purchase_place"?: string | null,"purchase_price"?: number | null,"quantity"?: number,"replace_after_months"?: number | null,"search_text"?: string,"search_vector"?: unknown,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"warranty_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "items_location_id_user_id_fkey"
      columns: ["location_id","user_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "builtin_key": string | null,"created_at": string,"id": string,"name": string,"name_en": string | null,"parent_id": string | null,"path_ids": (string)[],"path_text": string,"path_text_en": string,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "builtin_key"?: string | null,"created_at"?: string,"id"?: string,"name": string,"name_en"?: string | null,"parent_id"?: string | null,"path_ids"?: (string)[],"path_text"?: string,"path_text_en"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "builtin_key"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"name_en"?: string | null,"parent_id"?: string | null,"path_ids"?: (string)[],"path_text"?: string,"path_text_en"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_parent_id_user_id_fkey"
      columns: ["parent_id","user_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notifications_log": {
                  Row: {
                    "channel": string,"id": string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at": string,"threshold_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"id"?: string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key": string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_log_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "notifications_log_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"currency": string,"digest_hour": number,"expiry_lead_days": (number)[],"id": string,"locale": string,"notify_email": boolean,"notify_push": boolean,"timezone": string,"updated_at": string,"warranty_lead_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"digest_hour"?: number,"expiry_lead_days"?: (number)[],"id": string,"locale"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"timezone"?: string,"updated_at"?: string,"warranty_lead_days"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"digest_hour"?: number,"expiry_lead_days"?: (number)[],"id"?: string,"locale"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"timezone"?: string,"updated_at"?: string,"warranty_lead_days"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shopping_list": {
                  Row: {
                    "created_at": string,"done": boolean,"done_at": string | null,"id": string,"item_id": string | null,"name": string,"quantity": number,"unit": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"id"?: string,"item_id"?: string | null,"name": string,"quantity"?: number,"unit"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"id"?: string,"item_id"?: string | null,"name"?: string,"quantity"?: number,"unit"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "item_alerts"
      referencedColumns: ["item_id","user_id"]
    },{
      foreignKeyName: "shopping_list_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "item_alerts": {
                  Row: {
                    "category_id": string | null,"days_left": number | null,"due_date": string | null,"item_id": string | null,"kind": Database["public"]['Enums']["alert_kind"] | null,"location_id": string | null,"location_path": string | null,"location_path_en": string | null,"min_quantity": number | null,"name": string | null,"quantity": number | null,"replace_after_months": number | null,"severity": number | null,"snoozed": boolean | null,"snoozed_until": string | null,"threshold_key": string | null,"thumb_path": string | null,"unit": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "items_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "items_location_id_user_id_fkey"
      columns: ["location_id","user_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Functions: {
            "adjust_item_quantity":
{ Args: { "p_delta": number,"p_item_id": string,"p_note"?: string }; Returns: number
                           },
"category_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"item_count": number
            }[]
                           },
"compute_item_alerts":
{ Args: { "p_expiry_lead_days": (number)[],"p_item": Omit<Database["public"]['Tables']["items"]['Row'], Database["public"]['Tables']["items"]['ComputedFields']>,"p_today": string,"p_warranty_lead_days": number }; Returns: {
              "days_left": number,"due_date": string,"kind": Database["public"]['Enums']["alert_kind"],"severity": number,"threshold_key": string
            }[]
                           },
"dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"f_unaccent":
{ Args: { "input": string }; Returns: string
                           },
"location_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "item_count": number,"location_id": string
            }[]
                           },
"normalize_search":
{ Args: { "input": string }; Returns: string
                           },
"refresh_item_search":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"search_items":
{ Args: { "p_archived"?: boolean,"p_category_ids"?: (string)[],"p_conditions"?: (Database["public"]['Enums']["item_condition"])[],"p_limit"?: number,"p_location_id"?: string,"p_offset"?: number,"p_price_max"?: number,"p_price_min"?: number,"p_query"?: string,"p_sort"?: string,"p_states"?: (Database["public"]['Enums']["alert_kind"])[],"p_tag_ids"?: (string)[] }; Returns: {
              "alert_kinds": (Database["public"]['Enums']["alert_kind"])[],"category_id": string,"condition": Database["public"]['Enums']["item_condition"],"expiry_date": string,"id": string,"location_id": string,"location_path": string,"location_path_en": string,"min_quantity": number,"name": string,"purchase_price": number,"quantity": number,"rank": number,"thumb_path": string,"total_count": number,"unit": string,"updated_at": string,"warranty_until": string
            }[]
                           },
"search_tsquery":
{ Args: { "p_query": string }; Returns: unknown
                           },
"tag_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "item_count": number,"tag_id": string
            }[]
                           },
"user_today":
{ Args: { "p_timezone": string }; Returns: string
                           }
          }
          Enums: {
            "alert_kind": "expired"|"expiring_soon"|"out_of_stock"|"low_stock"|"warranty_ending"|"replace_due"|"lent_overdue","item_condition": "new"|"good"|"worn"|"broken"|"given_away","item_event_type": "created"|"quantity_change"|"moved"|"status_change"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "alert_kind": ["expired", "expiring_soon", "out_of_stock", "low_stock", "warranty_ending", "replace_due", "lent_overdue"],"item_condition": ["new", "good", "worn", "broken", "given_away"],"item_event_type": ["created", "quantity_change", "moved", "status_change"]
          }
        }
} as const
