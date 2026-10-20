
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "alert_snoozes": {
                  Row: {
                    "created_at": string,"household_id": string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"until": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_snoozes_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_snoozes_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "builtin_key": string | null,"created_at": string,"default_attributes": NonNullable<Json>,"household_id": string,"icon": string,"id": string,"name": string,"name_en": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "builtin_key"?: string | null,"created_at"?: string,"default_attributes"?: NonNullable<Json>,"household_id"?: string,"icon"?: string,"id"?: string,"name": string,"name_en"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "builtin_key"?: string | null,"created_at"?: string,"default_attributes"?: NonNullable<Json>,"household_id"?: string,"icon"?: string,"id"?: string,"name"?: string,"name_en"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"group_notifications_log": {
                  Row: {
                    "channel": string,"group_id": string,"household_id": string,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at": string,"threshold_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"group_id": string,"household_id": string,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key": string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"group_id"?: string,"household_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_notifications_log_group_id_user_id_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_group_stats"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "group_notifications_log_group_id_user_id_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_groups"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "group_notifications_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"household_id": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["household_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "household_id": string,"joined_at": string,"role": Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  Update: {
                    "household_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["household_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"id": string,"name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"item_documents": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"item_id": string,"kind": Database["public"]['Enums']["document_kind"],"mime_type": string,"size_bytes": number,"storage_path": string,"title": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"item_id": string,"kind"?: Database["public"]['Enums']["document_kind"],"mime_type": string,"size_bytes": number,"storage_path": string,"title": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["document_kind"],"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"title"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_documents_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_documents_item_id_household_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"item_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"delta": number | null,"from_condition": Database["public"]['Enums']["item_condition"] | null,"from_location_id": string | null,"household_id": string,"id": string,"item_id": string,"note": string | null,"quantity_after": number | null,"to_condition": Database["public"]['Enums']["item_condition"] | null,"to_location_id": string | null,"type": Database["public"]['Enums']["item_event_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"delta"?: number | null,"from_condition"?: Database["public"]['Enums']["item_condition"] | null,"from_location_id"?: string | null,"household_id"?: string,"id"?: string,"item_id": string,"note"?: string | null,"quantity_after"?: number | null,"to_condition"?: Database["public"]['Enums']["item_condition"] | null,"to_location_id"?: string | null,"type": Database["public"]['Enums']["item_event_type"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"delta"?: number | null,"from_condition"?: Database["public"]['Enums']["item_condition"] | null,"from_location_id"?: string | null,"household_id"?: string,"id"?: string,"item_id"?: string,"note"?: string | null,"quantity_after"?: number | null,"to_condition"?: Database["public"]['Enums']["item_condition"] | null,"to_location_id"?: string | null,"type"?: Database["public"]['Enums']["item_event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_events_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"item_groups": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"min_quantity": number | null,"name": string,"snoozed_until": string | null,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"min_quantity"?: number | null,"name": string,"snoozed_until"?: string | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"min_quantity"?: number | null,"name"?: string,"snoozed_until"?: string | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_groups_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"item_photos": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"item_id": string,"sort_order": number,"storage_path": string,"thumb_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"item_id": string,"sort_order"?: number,"storage_path": string,"thumb_path"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"item_id"?: string,"sort_order"?: number,"storage_path"?: string,"thumb_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_photos_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_photos_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"item_tags": {
                  Row: {
                    "household_id": string,"item_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id"?: string,"item_id": string,"tag_id": string
                  }
                  Update: {
                    "household_id"?: string,"item_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_tags_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_tags_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "item_tags_tag_id_user_id_fkey"
      columns: ["tag_id","household_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"items": {
                  Row: {
                    "archived_at": string | null,"attributes": NonNullable<Json>,"barcode": string | null,"category_id": string | null,"condition": Database["public"]['Enums']["item_condition"],"created_at": string,"expiry_date": string | null,"group_id": string | null,"household_id": string,"id": string,"last_replaced_at": string | null,"location_id": string | null,"min_quantity": number | null,"name": string,"name_norm": string | null,"notes": string | null,"opened_date": string | null,"purchase_date": string | null,"purchase_place": string | null,"purchase_price": number | null,"quantity": number,"replace_after_months": number | null,"search_text": string,"search_vector": unknown,"unit": string | null,"updated_at": string,"usage_last_at": string | null,"usage_per_day": number | null,"warranty_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"attributes"?: NonNullable<Json>,"barcode"?: string | null,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"expiry_date"?: string | null,"group_id"?: string | null,"household_id"?: string,"id"?: string,"last_replaced_at"?: string | null,"location_id"?: string | null,"min_quantity"?: number | null,"name": string,"name_norm"?: never,"notes"?: string | null,"opened_date"?: string | null,"purchase_date"?: string | null,"purchase_place"?: string | null,"purchase_price"?: number | null,"quantity"?: number,"replace_after_months"?: number | null,"search_text"?: string,"search_vector"?: unknown,"unit"?: string | null,"updated_at"?: string,"usage_last_at"?: string | null,"usage_per_day"?: number | null,"warranty_until"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"attributes"?: NonNullable<Json>,"barcode"?: string | null,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"expiry_date"?: string | null,"group_id"?: string | null,"household_id"?: string,"id"?: string,"last_replaced_at"?: string | null,"location_id"?: string | null,"min_quantity"?: number | null,"name"?: string,"name_norm"?: never,"notes"?: string | null,"opened_date"?: string | null,"purchase_date"?: string | null,"purchase_place"?: string | null,"purchase_price"?: number | null,"quantity"?: number,"replace_after_months"?: number | null,"search_text"?: string,"search_vector"?: unknown,"unit"?: string | null,"updated_at"?: string,"usage_last_at"?: string | null,"usage_per_day"?: number | null,"warranty_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_category_id_user_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "items_group_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_group_stats"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "items_group_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_groups"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_location_id_user_id_fkey"
      columns: ["location_id","household_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "builtin_key": string | null,"created_at": string,"household_id": string,"id": string,"name": string,"name_en": string | null,"parent_id": string | null,"path_ids": (string)[],"path_text": string,"path_text_en": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "builtin_key"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"name": string,"name_en"?: string | null,"parent_id"?: string | null,"path_ids"?: (string)[],"path_text"?: string,"path_text_en"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "builtin_key"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string,"name_en"?: string | null,"parent_id"?: string | null,"path_ids"?: (string)[],"path_text"?: string,"path_text_en"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_parent_id_user_id_fkey"
      columns: ["parent_id","household_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"maintenance_log": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"done_on": string,"household_id": string,"id": string,"note": string | null,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"done_on": string,"household_id"?: string,"id"?: string,"note"?: string | null,"task_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"done_on"?: string,"household_id"?: string,"id"?: string,"note"?: string | null,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_log_task_id_household_id_fkey"
      columns: ["task_id","household_id"]
isOneToOne: false
      referencedRelation: "maintenance_tasks"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"maintenance_notifications_log": {
                  Row: {
                    "channel": string,"household_id": string,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at": string,"task_id": string,"threshold_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"household_id": string,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"task_id": string,"threshold_key": string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"household_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"task_id"?: string,"threshold_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_notifications_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_notifications_log_task_id_household_id_fkey"
      columns: ["task_id","household_id"]
isOneToOne: false
      referencedRelation: "maintenance_tasks"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"maintenance_tasks": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"interval_count": number,"interval_unit": Database["public"]['Enums']["interval_unit"],"item_id": string | null,"last_done_on": string | null,"next_due": string,"notes": string | null,"snoozed_until": string | null,"start_date": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"interval_count": number,"interval_unit": Database["public"]['Enums']["interval_unit"],"item_id"?: string | null,"last_done_on"?: string | null,"next_due"?: string,"notes"?: string | null,"snoozed_until"?: string | null,"start_date"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"interval_count"?: number,"interval_unit"?: Database["public"]['Enums']["interval_unit"],"item_id"?: string | null,"last_done_on"?: string | null,"next_due"?: string,"notes"?: string | null,"snoozed_until"?: string | null,"start_date"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_tasks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_tasks_item_id_household_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"notifications_log": {
                  Row: {
                    "channel": string,"household_id": string,"id": string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at": string,"threshold_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"household_id": string,"id"?: string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key": string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"household_id"?: string,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"sent_at"?: string,"threshold_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_log_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active_household_id": string | null,"created_at": string,"currency": string,"digest_hour": number,"display_name": string | null,"expiry_lead_days": (number)[],"id": string,"locale": string,"maintenance_lead_days": number,"notify_email": boolean,"notify_push": boolean,"theme": string,"timezone": string,"unused_after_days": number,"updated_at": string,"warranty_lead_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active_household_id"?: string | null,"created_at"?: string,"currency"?: string,"digest_hour"?: number,"display_name"?: string | null,"expiry_lead_days"?: (number)[],"id": string,"locale"?: string,"maintenance_lead_days"?: number,"notify_email"?: boolean,"notify_push"?: boolean,"theme"?: string,"timezone"?: string,"unused_after_days"?: number,"updated_at"?: string,"warranty_lead_days"?: number
                  }
                  Update: {
                    "active_household_id"?: string | null,"created_at"?: string,"currency"?: string,"digest_hour"?: number,"display_name"?: string | null,"expiry_lead_days"?: (number)[],"id"?: string,"locale"?: string,"maintenance_lead_days"?: number,"notify_email"?: boolean,"notify_push"?: boolean,"theme"?: string,"timezone"?: string,"unused_after_days"?: number,"updated_at"?: string,"warranty_lead_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_active_household_id_fkey"
      columns: ["active_household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
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
                    "created_at": string,"done": boolean,"done_at": string | null,"group_id": string | null,"household_id": string,"id": string,"item_id": string | null,"name": string,"quantity": number,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"group_id"?: string | null,"household_id"?: string,"id"?: string,"item_id"?: string | null,"name": string,"quantity"?: number,"unit"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"group_id"?: string | null,"household_id"?: string,"id"?: string,"item_id"?: string | null,"name"?: string,"quantity"?: number,"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_group_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_group_stats"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "shopping_list_group_fkey"
      columns: ["group_id","household_id"]
isOneToOne: false
      referencedRelation: "item_groups"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "shopping_list_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"suggestion_dismissals": {
                  Row: {
                    "created_at": string,"household_id": string,"item_id": string,"reason": string,"until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"item_id": string,"reason": string,"until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"item_id"?: string,"reason"?: string,"until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestion_dismissals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestion_dismissals_item_id_user_id_fkey"
      columns: ["item_id","household_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "group_alerts": {
                  Row: {
                    "group_id": string | null,"household_id": string | null,"kind": Database["public"]['Enums']["alert_kind"] | null,"members": number | null,"min_quantity": number | null,"name": string | null,"severity": number | null,"snoozed": boolean | null,"snoozed_until": string | null,"threshold_key": string | null,"total": number | null,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"item_alerts": {
                  Row: {
                    "category_id": string | null,"days_left": number | null,"due_date": string | null,"household_id": string | null,"item_id": string | null,"kind": Database["public"]['Enums']["alert_kind"] | null,"location_id": string | null,"location_path": string | null,"location_path_en": string | null,"min_quantity": number | null,"name": string | null,"quantity": number | null,"replace_after_months": number | null,"severity": number | null,"snoozed": boolean | null,"snoozed_until": string | null,"threshold_key": string | null,"thumb_path": string | null,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"item_group_stats": {
                  Row: {
                    "household_id": string | null,"id": string | null,"members": number | null,"min_quantity": number | null,"name": string | null,"snoozed_until": string | null,"total": number | null,"unit": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "item_groups_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_alerts": {
                  Row: {
                    "days_left": number | null,"due_date": string | null,"household_id": string | null,"interval_count": number | null,"interval_unit": Database["public"]['Enums']["interval_unit"] | null,"item_id": string | null,"item_name": string | null,"kind": Database["public"]['Enums']["alert_kind"] | null,"severity": number | null,"snoozed": boolean | null,"snoozed_until": string | null,"task_id": string | null,"threshold_key": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_household_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"add_interval":
{ Args: { "p_count": number,"p_from": string,"p_unit": Database["public"]['Enums']["interval_unit"] }; Returns: string
                           },
"adjust_item_quantity":
{ Args: { "p_delta": number,"p_item_id": string,"p_note"?: string }; Returns: number
                           },
"can_edit_household":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"category_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"item_count": number
            }[]
                           },
"complete_maintenance_task":
{ Args: { "p_done_on"?: string,"p_note"?: string,"p_task_id": string }; Returns: string
                           },
"compute_item_alerts":
{ Args: { "p_expiry_lead_days": (number)[],"p_item": Omit<Database["public"]['Tables']["items"]['Row'], Database["public"]['Tables']["items"]['ComputedFields']>,"p_today": string,"p_warranty_lead_days": number }; Returns: {
              "days_left": number,"due_date": string,"kind": Database["public"]['Enums']["alert_kind"],"severity": number,"threshold_key": string
            }[]
                           },
"compute_maintenance_alerts":
{ Args: { "p_lead_days": number,"p_task": Omit<Database["public"]['Tables']["maintenance_tasks"]['Row'], Database["public"]['Tables']["maintenance_tasks"]['ComputedFields']>,"p_today": string }; Returns: {
              "days_left": number,"due_date": string,"kind": Database["public"]['Enums']["alert_kind"],"severity": number,"threshold_key": string
            }[]
                           },
"current_household_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_household_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["household_role"]
                           },
"dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"f_unaccent":
{ Args: { "input": string }; Returns: string
                           },
"household_invite_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"household_name": string,"inviter_name": string,"owner_name": string,"role": Database["public"]['Enums']["household_role"],"status": string
            }[]
                           },
"household_member_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": Database["public"]['Enums']["household_role"],"user_id": string
            }[]
                           },
"household_people":
{ Args: Record<PropertyKey, never>; Returns: {
              "display_name": string,"is_member": boolean,"user_id": string
            }[]
                           },
"insurance_report":
{ Args: { "p_category_ids"?: (string)[],"p_location_id"?: string,"p_min_value"?: number }; Returns: Json
                           },
"is_household_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"location_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "item_count": number,"location_id": string
            }[]
                           },
"my_household_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_households":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,"id": string,"members": number,"name": string,"owner_name": string,"role": Database["public"]['Enums']["household_role"]
            }[]
                           },
"normalize_search":
{ Args: { "input": string }; Returns: string
                           },
"refresh_item_search":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"refresh_item_usage":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"search_items":
{ Args: { "p_archived"?: boolean,"p_category_ids"?: (string)[],"p_conditions"?: (Database["public"]['Enums']["item_condition"])[],"p_group_id"?: string,"p_limit"?: number,"p_location_id"?: string,"p_offset"?: number,"p_price_max"?: number,"p_price_min"?: number,"p_query"?: string,"p_sort"?: string,"p_states"?: (Database["public"]['Enums']["alert_kind"])[],"p_tag_ids"?: (string)[] }; Returns: {
              "alert_kinds": (Database["public"]['Enums']["alert_kind"])[],"category_id": string,"condition": Database["public"]['Enums']["item_condition"],"expiry_date": string,"group_id": string,"id": string,"location_id": string,"location_path": string,"location_path_en": string,"min_quantity": number,"name": string,"purchase_price": number,"quantity": number,"rank": number,"thumb_path": string,"total_count": number,"unit": string,"updated_at": string,"warranty_until": string
            }[]
                           },
"search_tsquery":
{ Args: { "p_query": string }; Returns: unknown
                           },
"spending_stats":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"tag_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "item_count": number,"tag_id": string
            }[]
                           },
"unused_suggestion_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "reason": string,"total": number
            }[]
                           },
"unused_suggestions":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_reason"?: string }; Returns: {
              "category_id": string,"condition": Database["public"]['Enums']["item_condition"],"duplicate_of": string,"duplicates": number,"idle_days": number,"item_id": string,"last_activity": string,"location_id": string,"location_path": string,"location_path_en": string,"name": string,"purchase_price": number,"quantity": number,"reason": string,"thumb_path": string,"unit": string
            }[]
                           },
"user_group_alerts":
{ Args: { "p_user_id": string }; Returns: {
              "group_id": string,"household_id": string,"kind": Database["public"]['Enums']["alert_kind"],"members": number,"min_quantity": number,"name": string,"severity": number,"snoozed": boolean,"snoozed_until": string,"threshold_key": string,"total": number,"unit": string
            }[]
                           },
"user_item_alerts":
{ Args: { "p_user_id": string }; Returns: {
              "category_id": string,"days_left": number,"due_date": string,"household_id": string,"item_id": string,"kind": Database["public"]['Enums']["alert_kind"],"location_id": string,"location_path": string,"location_path_en": string,"min_quantity": number,"name": string,"quantity": number,"replace_after_months": number,"severity": number,"snoozed": boolean,"snoozed_until": string,"threshold_key": string,"thumb_path": string,"unit": string
            }[]
                           },
"user_maintenance_alerts":
{ Args: { "p_user_id": string }; Returns: {
              "days_left": number,"due_date": string,"household_id": string,"interval_count": number,"interval_unit": Database["public"]['Enums']["interval_unit"],"item_id": string,"item_name": string,"kind": Database["public"]['Enums']["alert_kind"],"severity": number,"snoozed": boolean,"snoozed_until": string,"task_id": string,"threshold_key": string,"title": string
            }[]
                           },
"user_today":
{ Args: { "p_timezone": string }; Returns: string
                           }
          }
          Enums: {
            "alert_kind": "expired"|"expiring_soon"|"out_of_stock"|"low_stock"|"warranty_ending"|"replace_due"|"lent_overdue"|"maintenance_due"|"maintenance_overdue"|"borrow_due"|"running_out","document_kind": "warranty"|"invoice"|"manual"|"other","household_role": "owner"|"editor"|"viewer","interval_unit": "day"|"week"|"month"|"year","item_condition": "new"|"good"|"worn"|"broken"|"given_away","item_event_type": "created"|"quantity_change"|"moved"|"status_change"|"maintenance"|"lent"|"borrowed"|"returned"
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
            "alert_kind": ["expired", "expiring_soon", "out_of_stock", "low_stock", "warranty_ending", "replace_due", "lent_overdue", "maintenance_due", "maintenance_overdue", "borrow_due", "running_out"],"document_kind": ["warranty", "invoice", "manual", "other"],"household_role": ["owner", "editor", "viewer"],"interval_unit": ["day", "week", "month", "year"],"item_condition": ["new", "good", "worn", "broken", "given_away"],"item_event_type": ["created", "quantity_change", "moved", "status_change", "maintenance", "lent", "borrowed", "returned"]
          }
        }
} as const
