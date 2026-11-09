
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "attachment_links": {
                  Row: {
                    "attachment_id": string,"entity_id": string,"entity_type": Database["public"]['Enums']["attachment_entity"],"evidence_role": Database["public"]['Enums']["evidence_role"],"id": string,"linked_at": string,"linked_by": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_id": string,"entity_id": string,"entity_type": Database["public"]['Enums']["attachment_entity"],"evidence_role": Database["public"]['Enums']["evidence_role"],"id"?: string,"linked_at"?: string,"linked_by"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "attachment_id"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["attachment_entity"],"evidence_role"?: Database["public"]['Enums']["evidence_role"],"id"?: string,"linked_at"?: string,"linked_by"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachment_links_attachment_id_fkey"
      columns: ["attachment_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachment_links_linked_by_fkey"
      columns: ["linked_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachment_links_linked_by_fkey"
      columns: ["linked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "bucket": Database["public"]['Enums']["attachment_bucket"],"caption": string | null,"client_upload_id": string,"content_hash": string | null,"derivatives": NonNullable<Json>,"height": number | null,"id": string,"mime_type": string,"original_name": string | null,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"site_id": string | null,"size_bytes": number,"storage_key": string,"uploaded_at": string,"uploaded_by": string,"visibility": Database["public"]['Enums']["attachment_visibility"],"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": Database["public"]['Enums']["attachment_bucket"],"caption"?: string | null,"client_upload_id": string,"content_hash"?: string | null,"derivatives"?: NonNullable<Json>,"height"?: number | null,"id"?: string,"mime_type": string,"original_name"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"site_id"?: string | null,"size_bytes": number,"storage_key": string,"uploaded_at"?: string,"uploaded_by": string,"visibility"?: Database["public"]['Enums']["attachment_visibility"],"width"?: number | null
                  }
                  Update: {
                    "bucket"?: Database["public"]['Enums']["attachment_bucket"],"caption"?: string | null,"client_upload_id"?: string,"content_hash"?: string | null,"derivatives"?: NonNullable<Json>,"height"?: number | null,"id"?: string,"mime_type"?: string,"original_name"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"site_id"?: string | null,"size_bytes"?: number,"storage_key"?: string,"uploaded_at"?: string,"uploaded_by"?: string,"visibility"?: Database["public"]['Enums']["attachment_visibility"],"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity_id": string,"entity_type": string,"id": number,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id": string,"entity_type": string,"id"?: never,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: never,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"billing_rules": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"show_in_client_report": boolean,"site_id": string | null,"unit_price_cents": number,"unit_type": string,"updated_at": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"show_in_client_report"?: boolean,"site_id"?: string | null,"unit_price_cents": number,"unit_type": string,"updated_at"?: string,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"show_in_client_report"?: boolean,"site_id"?: string | null,"unit_price_cents"?: number,"unit_type"?: string,"updated_at"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_rules_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_rules_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_rules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_rules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_rules_site_id_fkey"
      columns: ["site_id","client_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id","client_id"]
    }
                  ]
                },"client_contact_sites": {
                  Row: {
                    "can_open_requests": boolean,"can_view_reports": boolean,"client_contact_id": string,"ended_at": string | null,"site_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_open_requests"?: boolean,"can_view_reports"?: boolean,"client_contact_id": string,"ended_at"?: string | null,"site_id": string
                  }
                  Update: {
                    "can_open_requests"?: boolean,"can_view_reports"?: boolean,"client_contact_id"?: string,"ended_at"?: string | null,"site_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contact_sites_client_contact_id_fkey"
      columns: ["client_contact_id"]
isOneToOne: false
      referencedRelation: "client_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contact_sites_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contact_sites_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"client_contacts": {
                  Row: {
                    "anonymized_at": string | null,"client_id": string,"created_at": string,"email": string | null,"id": string,"is_active": boolean,"name": string,"phone": string | null,"role_title": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"client_id": string,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"phone"?: string | null,"role_title"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "anonymized_at"?: string | null,"client_id"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"phone"?: string | null,"role_title"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "address_text": string | null,"billing_info": string | null,"created_at": string,"created_by": string | null,"display_name": string,"document": string | null,"document_digits": string | null,"email": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["client_kind"],"legal_name": string,"notes_internal": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_text"?: string | null,"billing_info"?: string | null,"created_at"?: string,"created_by"?: string | null,"display_name": string,"document"?: string | null,"document_digits"?: never,"email"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["client_kind"],"legal_name": string,"notes_internal"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address_text"?: string | null,"billing_info"?: string | null,"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"document"?: string | null,"document_digits"?: never,"email"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["client_kind"],"legal_name"?: string,"notes_internal"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"closing_versions": {
                  Row: {
                    "closing_id": string,"criteria": NonNullable<Json>,"cutoff_at": string,"generated_at": string,"generated_by": string | null,"header_snapshot": NonNullable<Json>,"id": string,"payload": NonNullable<Json>,"period_start": string,"reason": string | null,"summary": NonNullable<Json>,"supersedes_version_id": string | null,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closing_id": string,"criteria": NonNullable<Json>,"cutoff_at": string,"generated_at"?: string,"generated_by"?: string | null,"header_snapshot": NonNullable<Json>,"id"?: string,"payload": NonNullable<Json>,"period_start": string,"reason"?: string | null,"summary": NonNullable<Json>,"supersedes_version_id"?: string | null,"version_no": number
                  }
                  Update: {
                    "closing_id"?: string,"criteria"?: NonNullable<Json>,"cutoff_at"?: string,"generated_at"?: string,"generated_by"?: string | null,"header_snapshot"?: NonNullable<Json>,"id"?: string,"payload"?: NonNullable<Json>,"period_start"?: string,"reason"?: string | null,"summary"?: NonNullable<Json>,"supersedes_version_id"?: string | null,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "closing_versions_closing_id_fkey"
      columns: ["closing_id"]
isOneToOne: false
      referencedRelation: "monthly_closings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "closing_versions_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "closing_versions_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "closing_versions_supersedes_version_id_fkey"
      columns: ["supersedes_version_id"]
isOneToOne: false
      referencedRelation: "closing_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"company_settings": {
                  Row: {
                    "activity_backdate_limit_days": number,"address_text": string | null,"cnpj": string | null,"crea": string | null,"email": string | null,"id": number,"legal_name": string,"logo_attachment_id": string | null,"max_files_per_upload": number,"max_image_mb": number,"max_pdf_mb": number,"phone": string | null,"quote_declaration_text": string | null,"quote_intro_text": string,"report_city": string | null,"report_footer_text": string | null,"report_objective_text": string,"retention_policy": string | null,"signature_attachment_id": string | null,"technical_manager_name": string | null,"technical_manager_title": string | null,"trade_name": string,"updated_at": string,"updated_by": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_backdate_limit_days"?: number,"address_text"?: string | null,"cnpj"?: string | null,"crea"?: string | null,"email"?: string | null,"id"?: number,"legal_name"?: string,"logo_attachment_id"?: string | null,"max_files_per_upload"?: number,"max_image_mb"?: number,"max_pdf_mb"?: number,"phone"?: string | null,"quote_declaration_text"?: string | null,"quote_intro_text"?: string,"report_city"?: string | null,"report_footer_text"?: string | null,"report_objective_text"?: string,"retention_policy"?: string | null,"signature_attachment_id"?: string | null,"technical_manager_name"?: string | null,"technical_manager_title"?: string | null,"trade_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "activity_backdate_limit_days"?: number,"address_text"?: string | null,"cnpj"?: string | null,"crea"?: string | null,"email"?: string | null,"id"?: number,"legal_name"?: string,"logo_attachment_id"?: string | null,"max_files_per_upload"?: number,"max_image_mb"?: number,"max_pdf_mb"?: number,"phone"?: string | null,"quote_declaration_text"?: string | null,"quote_intro_text"?: string,"report_city"?: string | null,"report_footer_text"?: string | null,"report_objective_text"?: string,"retention_policy"?: string | null,"signature_attachment_id"?: string | null,"technical_manager_name"?: string | null,"technical_manager_title"?: string | null,"trade_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_allocations": {
                  Row: {
                    "amount_cents": number,"expense_id": string,"id": string,"purpose": string,"site_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"expense_id": string,"id"?: string,"purpose": string,"site_id": string,"sort_order"?: number
                  }
                  Update: {
                    "amount_cents"?: number,"expense_id"?: string,"id"?: string,"purpose"?: string,"site_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_allocations_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"expense_reviews": {
                  Row: {
                    "action": Database["public"]['Enums']["expense_review_action"],"actor_id": string | null,"created_at": string,"expense_id": string,"id": number,"reason": string | null,"snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["expense_review_action"],"actor_id"?: string | null,"created_at"?: string,"expense_id": string,"id"?: never,"reason"?: string | null,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["expense_review_action"],"actor_id"?: string | null,"created_at"?: string,"expense_id"?: string,"id"?: never,"reason"?: string | null,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_reviews_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_reviews_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_reviews_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "approval_version": number,"client_request_id": string,"created_at": string,"created_by": string,"description": string,"document_number": string | null,"expense_category_id": string | null,"expense_date": string,"id": string,"items_notes": string | null,"notes": string | null,"paid_by_kind": Database["public"]['Enums']["payer_kind"],"paid_by_profile_id": string | null,"payment_method_id": string | null,"purchased_by": string,"review_status": Database["public"]['Enums']["expense_review_status"],"reviewed_at": string | null,"reviewed_by": string | null,"service_request_id": string | null,"submitted_at": string | null,"supplier_id": string | null,"supplier_name_free": string | null,"task_occurrence_id": string | null,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_version"?: number,"client_request_id": string,"created_at"?: string,"created_by": string,"description": string,"document_number"?: string | null,"expense_category_id"?: string | null,"expense_date": string,"id"?: string,"items_notes"?: string | null,"notes"?: string | null,"paid_by_kind"?: Database["public"]['Enums']["payer_kind"],"paid_by_profile_id"?: string | null,"payment_method_id"?: string | null,"purchased_by": string,"review_status"?: Database["public"]['Enums']["expense_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"service_request_id"?: string | null,"submitted_at"?: string | null,"supplier_id"?: string | null,"supplier_name_free"?: string | null,"task_occurrence_id"?: string | null,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "approval_version"?: number,"client_request_id"?: string,"created_at"?: string,"created_by"?: string,"description"?: string,"document_number"?: string | null,"expense_category_id"?: string | null,"expense_date"?: string,"id"?: string,"items_notes"?: string | null,"notes"?: string | null,"paid_by_kind"?: Database["public"]['Enums']["payer_kind"],"paid_by_profile_id"?: string | null,"payment_method_id"?: string | null,"purchased_by"?: string,"review_status"?: Database["public"]['Enums']["expense_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"service_request_id"?: string | null,"submitted_at"?: string | null,"supplier_id"?: string | null,"supplier_name_free"?: string | null,"task_occurrence_id"?: string | null,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_expense_category_id_fkey"
      columns: ["expense_category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_profile_id_fkey"
      columns: ["paid_by_profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_profile_id_fkey"
      columns: ["paid_by_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_purchased_by_fkey"
      columns: ["purchased_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_purchased_by_fkey"
      columns: ["purchased_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_task_occurrence_id_fkey"
      columns: ["task_occurrence_id"]
isOneToOne: false
      referencedRelation: "task_occurrences"
      referencedColumns: ["id"]
    }
                  ]
                },"monthly_closings": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string,"current_version_id": string | null,"id": string,"notes_internal": string | null,"period_month": number,"period_year": number,"site_id": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by": string,"current_version_id"?: string | null,"id"?: string,"notes_internal"?: string | null,"period_month": number,"period_year": number,"site_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string,"current_version_id"?: string | null,"id"?: string,"notes_internal"?: string | null,"period_month"?: number,"period_year"?: number,"site_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "monthly_closings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_closings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_closings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_closings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_closings_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "closing_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_closings_site_id_fkey"
      columns: ["site_id","client_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id","client_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"link": string | null,"profile_id": string,"read_at": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"profile_id": string,"read_at"?: string | null,"title": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"profile_id"?: string,"read_at"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"pending_reasons": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"permission_catalog": {
                  Row: {
                    "action": string,"admin_floor": boolean,"client_never": boolean,"label": string,"module": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_floor"?: boolean,"client_never"?: boolean,"label": string,"module": string
                  }
                  Update: {
                    "action"?: string,"admin_floor"?: boolean,"client_never"?: boolean,"label"?: string,"module"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permission_overrides": {
                  Row: {
                    "action": string,"allowed": boolean,"created_at": string,"expires_at": string | null,"granted_by": string | null,"id": string,"module": string,"profile_id": string,"reason": string,"site_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"allowed": boolean,"created_at"?: string,"expires_at"?: string | null,"granted_by"?: string | null,"id"?: string,"module": string,"profile_id": string,"reason": string,"site_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"allowed"?: boolean,"created_at"?: string,"expires_at"?: string | null,"granted_by"?: string | null,"id"?: string,"module"?: string,"profile_id"?: string,"reason"?: string,"site_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "permission_overrides_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_overrides_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_overrides_module_action_fkey"
      columns: ["module","action"]
isOneToOne: false
      referencedRelation: "permission_catalog"
      referencedColumns: ["module","action"]
    },{
      foreignKeyName: "permission_overrides_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_overrides_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_overrides_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_overrides_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"priority_definitions": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"level": number,"name": string,"sla_days": number | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"level"?: number,"name": string,"sla_days"?: number | null,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"level"?: number,"name"?: string,"sla_days"?: number | null,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deactivated_at": string | null,"email": string,"full_name": string,"id": string,"is_active": boolean,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deactivated_at"?: string | null,"email": string,"full_name": string,"id": string,"is_active"?: boolean,"phone"?: string | null,"role": Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deactivated_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quote_items": {
                  Row: {
                    "id": string,"lines": (string)[],"location_label": string,"notes": string | null,"pricing_mode": string,"quantity": number | null,"quote_id": string,"sort_order": number,"subtotal_cents": number,"title": string | null,"unit": string | null,"unit_price_cents": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"lines"?: (string)[],"location_label": string,"notes"?: string | null,"pricing_mode": string,"quantity"?: number | null,"quote_id": string,"sort_order"?: number,"subtotal_cents": number,"title"?: string | null,"unit"?: string | null,"unit_price_cents"?: number | null
                  }
                  Update: {
                    "id"?: string,"lines"?: (string)[],"location_label"?: string,"notes"?: string | null,"pricing_mode"?: string,"quantity"?: number | null,"quote_id"?: string,"sort_order"?: number,"subtotal_cents"?: number,"title"?: string | null,"unit"?: string | null,"unit_price_cents"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_items_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    }
                  ]
                },"quote_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"quote_id": string,"reason": string | null,"snapshot": NonNullable<Json>,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"quote_id": string,"reason"?: string | null,"snapshot": NonNullable<Json>,"version_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"quote_id"?: string,"reason"?: string | null,"snapshot"?: NonNullable<Json>,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quote_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quote_versions_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    }
                  ]
                },"quotes": {
                  Row: {
                    "accepted_at": string | null,"accepted_note": string | null,"approved_version_no": number | null,"client_contact_id": string | null,"client_id": string,"client_request_id": string | null,"created_at": string,"created_by": string,"current_version_no": number,"declaration_text": string | null,"execution_deadline_text": string | null,"id": string,"inclusions_text": string | null,"intro_text": string | null,"issued_at": string,"last_save_request_id": string | null,"number": string,"observations": string | null,"payment_terms": string | null,"service_location_text": string | null,"site_id": string | null,"status": string,"status_reason": string | null,"technical_notes": string | null,"title": string | null,"total_cents": number,"updated_at": string,"valid_until": string | null,"warranty_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_note"?: string | null,"approved_version_no"?: number | null,"client_contact_id"?: string | null,"client_id": string,"client_request_id"?: string | null,"created_at"?: string,"created_by": string,"current_version_no"?: number,"declaration_text"?: string | null,"execution_deadline_text"?: string | null,"id"?: string,"inclusions_text"?: string | null,"intro_text"?: string | null,"issued_at"?: string,"last_save_request_id"?: string | null,"number": string,"observations"?: string | null,"payment_terms"?: string | null,"service_location_text"?: string | null,"site_id"?: string | null,"status"?: string,"status_reason"?: string | null,"technical_notes"?: string | null,"title"?: string | null,"total_cents"?: number,"updated_at"?: string,"valid_until"?: string | null,"warranty_text"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_note"?: string | null,"approved_version_no"?: number | null,"client_contact_id"?: string | null,"client_id"?: string,"client_request_id"?: string | null,"created_at"?: string,"created_by"?: string,"current_version_no"?: number,"declaration_text"?: string | null,"execution_deadline_text"?: string | null,"id"?: string,"inclusions_text"?: string | null,"intro_text"?: string | null,"issued_at"?: string,"last_save_request_id"?: string | null,"number"?: string,"observations"?: string | null,"payment_terms"?: string | null,"service_location_text"?: string | null,"site_id"?: string | null,"status"?: string,"status_reason"?: string | null,"technical_notes"?: string | null,"title"?: string | null,"total_cents"?: number,"updated_at"?: string,"valid_until"?: string | null,"warranty_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_client_contact_id_fkey"
      columns: ["client_contact_id"]
isOneToOne: false
      referencedRelation: "client_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_site_id_fkey"
      columns: ["site_id","client_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id","client_id"]
    }
                  ]
                },"reimbursement_payments": {
                  Row: {
                    "amount_cents": number,"client_request_id": string,"created_at": string,"created_by": string | null,"id": string,"kind": string,"notes": string | null,"paid_on": string,"payment_method_id": string | null,"reimbursement_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"client_request_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"paid_on": string,"payment_method_id"?: string | null,"reimbursement_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"client_request_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"paid_on"?: string,"payment_method_id"?: string | null,"reimbursement_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reimbursement_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursement_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursement_payments_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursement_payments_reimbursement_id_fkey"
      columns: ["reimbursement_id"]
isOneToOne: false
      referencedRelation: "reimbursements"
      referencedColumns: ["id"]
    }
                  ]
                },"reimbursements": {
                  Row: {
                    "amount_due_cents": number,"amount_paid_cents": number,"created_at": string,"expense_id": string,"id": string,"payee_profile_id": string,"settled_at": string | null,"settled_by": string | null,"settlement_notes": string | null,"status": Database["public"]['Enums']["reimbursement_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due_cents": number,"amount_paid_cents"?: number,"created_at"?: string,"expense_id": string,"id"?: string,"payee_profile_id": string,"settled_at"?: string | null,"settled_by"?: string | null,"settlement_notes"?: string | null,"status"?: Database["public"]['Enums']["reimbursement_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_due_cents"?: number,"amount_paid_cents"?: number,"created_at"?: string,"expense_id"?: string,"id"?: string,"payee_profile_id"?: string,"settled_at"?: string | null,"settled_by"?: string | null,"settlement_notes"?: string | null,"status"?: Database["public"]['Enums']["reimbursement_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reimbursements_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: true
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursements_payee_profile_id_fkey"
      columns: ["payee_profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursements_payee_profile_id_fkey"
      columns: ["payee_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursements_settled_by_fkey"
      columns: ["settled_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursements_settled_by_fkey"
      columns: ["settled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_artifacts": {
                  Row: {
                    "attempts": number,"audience": string,"error_message": string | null,"file_name": string,"finished_at": string | null,"id": string,"kind": string,"page_count": number | null,"params": NonNullable<Json>,"requested_at": string,"requested_by": string | null,"size_bytes": number | null,"source_id": string | null,"source_type": string,"started_at": string | null,"status": string,"storage_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"audience"?: string,"error_message"?: string | null,"file_name": string,"finished_at"?: string | null,"id"?: string,"kind": string,"page_count"?: number | null,"params"?: NonNullable<Json>,"requested_at"?: string,"requested_by"?: string | null,"size_bytes"?: number | null,"source_id"?: string | null,"source_type": string,"started_at"?: string | null,"status"?: string,"storage_key"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"audience"?: string,"error_message"?: string | null,"file_name"?: string,"finished_at"?: string | null,"id"?: string,"kind"?: string,"page_count"?: number | null,"params"?: NonNullable<Json>,"requested_at"?: string,"requested_by"?: string | null,"size_bytes"?: number | null,"source_id"?: string | null,"source_type"?: string,"started_at"?: string | null,"status"?: string,"storage_key"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_artifacts_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_artifacts_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_publications": {
                  Row: {
                    "closing_version_id": string,"delivery_channel": string | null,"delivery_note": string | null,"id": string,"published_at": string,"published_by": string | null,"report_artifact_id": string | null,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closing_version_id": string,"delivery_channel"?: string | null,"delivery_note"?: string | null,"id"?: string,"published_at"?: string,"published_by"?: string | null,"report_artifact_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null
                  }
                  Update: {
                    "closing_version_id"?: string,"delivery_channel"?: string | null,"delivery_note"?: string | null,"id"?: string,"published_at"?: string,"published_by"?: string | null,"report_artifact_id"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_publications_closing_version_id_fkey"
      columns: ["closing_version_id"]
isOneToOne: false
      referencedRelation: "closing_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_publications_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_publications_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_publications_report_artifact_id_fkey"
      columns: ["report_artifact_id"]
isOneToOne: false
      referencedRelation: "report_artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_publications_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_publications_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"request_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"id": string,"profile_id": string,"service_request_id": string,"unassigned_at": string | null,"unassigned_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"id"?: string,"profile_id": string,"service_request_id": string,"unassigned_at"?: string | null,"unassigned_by"?: string | null
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"id"?: string,"profile_id"?: string,"service_request_id"?: string,"unassigned_at"?: string | null,"unassigned_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_unassigned_by_fkey"
      columns: ["unassigned_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_assignments_unassigned_by_fkey"
      columns: ["unassigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"request_comments": {
                  Row: {
                    "author_id": string,"body": string,"client_request_id": string,"created_at": string,"id": string,"is_internal": boolean,"service_request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"client_request_id": string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"service_request_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"client_request_id"?: string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"service_request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_comments_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"request_events": {
                  Row: {
                    "actor_id": string | null,"event_type": Database["public"]['Enums']["request_event_type"],"from_status": Database["public"]['Enums']["request_status"] | null,"id": number,"is_internal": boolean,"occurred_at": string,"payload": NonNullable<Json>,"reason": string | null,"service_request_id": string,"to_status": Database["public"]['Enums']["request_status"] | null,"work_entry_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"event_type": Database["public"]['Enums']["request_event_type"],"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"is_internal"?: boolean,"occurred_at"?: string,"payload"?: NonNullable<Json>,"reason"?: string | null,"service_request_id": string,"to_status"?: Database["public"]['Enums']["request_status"] | null,"work_entry_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"event_type"?: Database["public"]['Enums']["request_event_type"],"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"is_internal"?: boolean,"occurred_at"?: string,"payload"?: NonNullable<Json>,"reason"?: string | null,"service_request_id"?: string,"to_status"?: Database["public"]['Enums']["request_status"] | null,"work_entry_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_events_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_events_work_entry_fk"
      columns: ["work_entry_id"]
isOneToOne: false
      referencedRelation: "work_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "action": string,"allowed": boolean,"id": string,"module": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"allowed"?: boolean,"id"?: string,"module": string,"role": Database["public"]['Enums']["user_role"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "action"?: string,"allowed"?: boolean,"id"?: string,"module"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_module_action_fkey"
      columns: ["module","action"]
isOneToOne: false
      referencedRelation: "permission_catalog"
      referencedColumns: ["module","action"]
    },{
      foreignKeyName: "role_permissions_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_permissions_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"service_categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"service_requests": {
                  Row: {
                    "cancelled_at": string | null,"channel": Database["public"]['Enums']["request_channel"] | null,"client_id": string,"client_request_id": string,"closed_at": string | null,"created_at": string,"created_by": string,"current_pending": Json | null,"description": string,"due_date": string | null,"id": string,"is_internal": boolean,"number": string,"opened_at": string,"origin": Database["public"]['Enums']["request_origin"],"priority_id": string | null,"requester_contact_id": string | null,"requester_name": string | null,"scheduled_date": string | null,"service_category_id": string | null,"site_area_id": string | null,"site_id": string,"status": Database["public"]['Enums']["request_status"],"task_id": string | null,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"channel"?: Database["public"]['Enums']["request_channel"] | null,"client_id": string,"client_request_id": string,"closed_at"?: string | null,"created_at"?: string,"created_by": string,"current_pending"?: Json | null,"description": string,"due_date"?: string | null,"id"?: string,"is_internal"?: boolean,"number": string,"opened_at"?: string,"origin": Database["public"]['Enums']["request_origin"],"priority_id"?: string | null,"requester_contact_id"?: string | null,"requester_name"?: string | null,"scheduled_date"?: string | null,"service_category_id"?: string | null,"site_area_id"?: string | null,"site_id": string,"status"?: Database["public"]['Enums']["request_status"],"task_id"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "cancelled_at"?: string | null,"channel"?: Database["public"]['Enums']["request_channel"] | null,"client_id"?: string,"client_request_id"?: string,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string,"current_pending"?: Json | null,"description"?: string,"due_date"?: string | null,"id"?: string,"is_internal"?: boolean,"number"?: string,"opened_at"?: string,"origin"?: Database["public"]['Enums']["request_origin"],"priority_id"?: string | null,"requester_contact_id"?: string | null,"requester_name"?: string | null,"scheduled_date"?: string | null,"service_category_id"?: string | null,"site_area_id"?: string | null,"site_id"?: string,"status"?: Database["public"]['Enums']["request_status"],"task_id"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_priority_id_fkey"
      columns: ["priority_id"]
isOneToOne: false
      referencedRelation: "priority_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_requester_contact_id_fkey"
      columns: ["requester_contact_id"]
isOneToOne: false
      referencedRelation: "client_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_service_category_id_fkey"
      columns: ["service_category_id"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_site_area_id_site_id_fkey"
      columns: ["site_area_id","site_id"]
isOneToOne: false
      referencedRelation: "site_areas"
      referencedColumns: ["id","site_id"]
    },{
      foreignKeyName: "service_requests_site_id_client_id_fkey"
      columns: ["site_id","client_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id","client_id"]
    },{
      foreignKeyName: "service_requests_task_fk"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"site_areas": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"site_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"site_id": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"site_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_areas_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_areas_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"site_memberships": {
                  Row: {
                    "active_from": string,"active_to": string | null,"created_at": string,"created_by": string | null,"id": string,"profile_id": string,"site_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_from"?: string,"active_to"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"profile_id": string,"site_id": string
                  }
                  Update: {
                    "active_from"?: string,"active_to"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"profile_id"?: string,"site_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_memberships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_memberships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_memberships_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "site_memberships_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"sites": {
                  Row: {
                    "access_hours": string | null,"access_instructions": string | null,"address_text": string | null,"client_id": string,"client_responsible_contact_id": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"notes_internal": string | null,"planned_end": string | null,"planned_start": string | null,"quote_id": string | null,"responsible_profile_id": string | null,"site_type": Database["public"]['Enums']["site_type"],"status": Database["public"]['Enums']["site_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_hours"?: string | null,"access_instructions"?: string | null,"address_text"?: string | null,"client_id": string,"client_responsible_contact_id"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"notes_internal"?: string | null,"planned_end"?: string | null,"planned_start"?: string | null,"quote_id"?: string | null,"responsible_profile_id"?: string | null,"site_type": Database["public"]['Enums']["site_type"],"status"?: Database["public"]['Enums']["site_status"],"updated_at"?: string
                  }
                  Update: {
                    "access_hours"?: string | null,"access_instructions"?: string | null,"address_text"?: string | null,"client_id"?: string,"client_responsible_contact_id"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"notes_internal"?: string | null,"planned_end"?: string | null,"planned_start"?: string | null,"quote_id"?: string | null,"responsible_profile_id"?: string | null,"site_type"?: Database["public"]['Enums']["site_type"],"status"?: Database["public"]['Enums']["site_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sites_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "client_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_client_responsible_contact_fkey"
      columns: ["client_responsible_contact_id","client_id"]
isOneToOne: false
      referencedRelation: "client_contacts"
      referencedColumns: ["id","client_id"]
    },{
      foreignKeyName: "sites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_quote_fk"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_responsible_profile_id_fkey"
      columns: ["responsible_profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_responsible_profile_id_fkey"
      columns: ["responsible_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "created_at": string,"document": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"phone": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"phone"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"document"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"phone"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"task_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"profile_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"profile_id": string,"task_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"profile_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_kinds": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"task_occurrences": {
                  Row: {
                    "created_at": string,"finished_at": string | null,"id": string,"no_show_reason": string | null,"notes": string | null,"scheduled_date": string,"site_area_id": string | null,"site_id": string,"sort_order": number,"started_at": string | null,"status": Database["public"]['Enums']["occurrence_status"],"task_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"finished_at"?: string | null,"id"?: string,"no_show_reason"?: string | null,"notes"?: string | null,"scheduled_date": string,"site_area_id"?: string | null,"site_id": string,"sort_order"?: number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["occurrence_status"],"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"finished_at"?: string | null,"id"?: string,"no_show_reason"?: string | null,"notes"?: string | null,"scheduled_date"?: string,"site_area_id"?: string | null,"site_id"?: string,"sort_order"?: number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["occurrence_status"],"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_occurrences_site_area_id_site_id_fkey"
      columns: ["site_area_id","site_id"]
isOneToOne: false
      referencedRelation: "site_areas"
      referencedColumns: ["id","site_id"]
    },{
      foreignKeyName: "task_occurrences_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_occurrences_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_occurrences_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_request_id": string,"created_at": string,"created_by": string,"description": string | null,"due_date": string | null,"id": string,"kind_id": string | null,"priority_id": string | null,"scheduled_date": string,"service_request_id": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_request_id": string,"created_at"?: string,"created_by": string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind_id"?: string | null,"priority_id"?: string | null,"scheduled_date": string,"service_request_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_request_id"?: string,"created_at"?: string,"created_by"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind_id"?: string | null,"priority_id"?: string | null,"scheduled_date"?: string,"service_request_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_kind_id_fkey"
      columns: ["kind_id"]
isOneToOne: false
      referencedRelation: "task_kinds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_priority_id_fkey"
      columns: ["priority_id"]
isOneToOne: false
      referencedRelation: "priority_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"time_entries": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"billable": boolean,"billing_units": number,"created_at": string,"created_by": string | null,"hours": number | null,"id": string,"notes": string | null,"profile_id": string,"site_id": string,"source": string,"updated_at": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"billable"?: boolean,"billing_units"?: number,"created_at"?: string,"created_by"?: string | null,"hours"?: number | null,"id"?: string,"notes"?: string | null,"profile_id": string,"site_id": string,"source"?: string,"updated_at"?: string,"work_date": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"billable"?: boolean,"billing_units"?: number,"created_at"?: string,"created_by"?: string | null,"hours"?: number | null,"id"?: string,"notes"?: string | null,"profile_id"?: string,"site_id"?: string,"source"?: string,"updated_at"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_entries_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"work_entries": {
                  Row: {
                    "activity_date": string,"author_id": string,"blocker_reason_id": string | null,"client_request_id": string,"client_visible": boolean,"created_at": string,"description": string,"hours_worked": number | null,"id": string,"kind": Database["public"]['Enums']["work_kind"],"materials": string | null,"next_step": string | null,"outcome": Database["public"]['Enums']["work_outcome"],"review_status": Database["public"]['Enums']["work_review_status"],"reviewed_at": string | null,"reviewed_by": string | null,"service_request_id": string | null,"site_area_id": string | null,"site_id": string,"solution": string | null,"submitted_payload": NonNullable<Json>,"task_occurrence_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"author_id": string,"blocker_reason_id"?: string | null,"client_request_id": string,"client_visible"?: boolean,"created_at"?: string,"description": string,"hours_worked"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["work_kind"],"materials"?: string | null,"next_step"?: string | null,"outcome"?: Database["public"]['Enums']["work_outcome"],"review_status"?: Database["public"]['Enums']["work_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"service_request_id"?: string | null,"site_area_id"?: string | null,"site_id": string,"solution"?: string | null,"submitted_payload": NonNullable<Json>,"task_occurrence_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activity_date"?: string,"author_id"?: string,"blocker_reason_id"?: string | null,"client_request_id"?: string,"client_visible"?: boolean,"created_at"?: string,"description"?: string,"hours_worked"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["work_kind"],"materials"?: string | null,"next_step"?: string | null,"outcome"?: Database["public"]['Enums']["work_outcome"],"review_status"?: Database["public"]['Enums']["work_review_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"service_request_id"?: string | null,"site_area_id"?: string | null,"site_id"?: string,"solution"?: string | null,"submitted_payload"?: NonNullable<Json>,"task_occurrence_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_entries_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_blocker_reason_id_fkey"
      columns: ["blocker_reason_id"]
isOneToOne: false
      referencedRelation: "pending_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_service_request_id_fkey"
      columns: ["service_request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_site_area_id_site_id_fkey"
      columns: ["site_area_id","site_id"]
isOneToOne: false
      referencedRelation: "site_areas"
      referencedColumns: ["id","site_id"]
    },{
      foreignKeyName: "work_entries_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "site_internal"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entries_task_occurrence_id_fkey"
      columns: ["task_occurrence_id"]
isOneToOne: false
      referencedRelation: "task_occurrences"
      referencedColumns: ["id"]
    }
                  ]
                },"work_entry_participants": {
                  Row: {
                    "profile_id": string,"work_entry_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"work_entry_id": string
                  }
                  Update: {
                    "profile_id"?: string,"work_entry_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_entry_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profile_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entry_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_entry_participants_work_entry_id_fkey"
      columns: ["work_entry_id"]
isOneToOne: false
      referencedRelation: "work_entries"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "client_internal": {
                  Row: {
                    "billing_info": string | null,"id": string | null,"notes_internal": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "billing_info"?: string | null,"id"?: string | null,"notes_internal"?: string | null
                         }
                        Update: {
                           "billing_info"?: string | null,"id"?: string | null,"notes_internal"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"profile_contacts": {
                  Row: {
                    "email": string | null,"id": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "email"?: string | null,"id"?: string | null,"phone"?: string | null
                         }
                        Update: {
                           "email"?: string | null,"id"?: string | null,"phone"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"site_internal": {
                  Row: {
                    "id": string | null,"notes_internal": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"notes_internal"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"notes_internal"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "attachment_revoke":
{ Args: { "p_attachment_id": string,"p_reason": string }; Returns: undefined
                           },
"attachment_set_captions":
{ Args: { "p_captions": Json }; Returns: number
                           },
"audit_admin_action":
{ Args: { "p_action": string,"p_entity": string,"p_entity_id": string,"p_reason"?: string }; Returns: number
                           },
"can":
{ Args: { "p_action": string,"p_module": string,"p_site"?: string }; Returns: boolean
                           },
"closing_version_create":
{ Args: { "p_closing_id": string,"p_criteria": Json,"p_cutoff_at": string,"p_header": Json,"p_payload": Json,"p_period_start": string,"p_reason"?: string,"p_summary": Json }; Returns: {
              "closing_id": string,
"criteria": NonNullable<Json>,
"cutoff_at": string,
"generated_at": string,
"generated_by": string | null,
"header_snapshot": NonNullable<Json>,
"id": string,
"payload": NonNullable<Json>,
"period_start": string,
"reason": string | null,
"summary": NonNullable<Json>,
"supersedes_version_id": string | null,
"version_no": number
            }
                          SetofOptions: {
        from: "*"
        to: "closing_versions"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"dashboard_summary":
{ Args: { "p_attention_size"?: number,"p_client_id"?: string,"p_from": string,"p_person_id"?: string,"p_site_id"?: string,"p_to": string,"p_today": string }; Returns: Json
                           },
"expense_approve":
{ Args: { "p_expense_id": string,"p_note"?: string }; Returns: {
              "approval_version": number,
"client_request_id": string,
"created_at": string,
"created_by": string,
"description": string,
"document_number": string | null,
"expense_category_id": string | null,
"expense_date": string,
"id": string,
"items_notes": string | null,
"notes": string | null,
"paid_by_kind": Database["public"]['Enums']["payer_kind"],
"paid_by_profile_id": string | null,
"payment_method_id": string | null,
"purchased_by": string,
"review_status": Database["public"]['Enums']["expense_review_status"],
"reviewed_at": string | null,
"reviewed_by": string | null,
"service_request_id": string | null,
"submitted_at": string | null,
"supplier_id": string | null,
"supplier_name_free": string | null,
"task_occurrence_id": string | null,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "expenses"
        isOneToOne: true
        isSetofReturn: false
      } },
"expense_return":
{ Args: { "p_expense_id": string,"p_reason": string }; Returns: {
              "approval_version": number,
"client_request_id": string,
"created_at": string,
"created_by": string,
"description": string,
"document_number": string | null,
"expense_category_id": string | null,
"expense_date": string,
"id": string,
"items_notes": string | null,
"notes": string | null,
"paid_by_kind": Database["public"]['Enums']["payer_kind"],
"paid_by_profile_id": string | null,
"payment_method_id": string | null,
"purchased_by": string,
"review_status": Database["public"]['Enums']["expense_review_status"],
"reviewed_at": string | null,
"reviewed_by": string | null,
"service_request_id": string | null,
"submitted_at": string | null,
"supplier_id": string | null,
"supplier_name_free": string | null,
"task_occurrence_id": string | null,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "expenses"
        isOneToOne: true
        isSetofReturn: false
      } },
"expense_save":
{ Args: { "p_allocations": Json,"p_client_request_id": string,"p_description": string,"p_document_number"?: string,"p_expense_category_id"?: string,"p_expense_date": string,"p_expense_id"?: string,"p_items_notes"?: string,"p_notes"?: string,"p_paid_by_kind"?: Database["public"]['Enums']["payer_kind"],"p_paid_by_profile_id"?: string,"p_payment_method_id"?: string,"p_purchased_by"?: string,"p_receipt_ids"?: (string)[],"p_service_request_id"?: string,"p_submit"?: boolean,"p_supplier_id"?: string,"p_supplier_name_free"?: string,"p_task_occurrence_id"?: string,"p_total_cents": number }; Returns: {
              "approval_version": number,
"client_request_id": string,
"created_at": string,
"created_by": string,
"description": string,
"document_number": string | null,
"expense_category_id": string | null,
"expense_date": string,
"id": string,
"items_notes": string | null,
"notes": string | null,
"paid_by_kind": Database["public"]['Enums']["payer_kind"],
"paid_by_profile_id": string | null,
"payment_method_id": string | null,
"purchased_by": string,
"review_status": Database["public"]['Enums']["expense_review_status"],
"reviewed_at": string | null,
"reviewed_by": string | null,
"service_request_id": string | null,
"submitted_at": string | null,
"supplier_id": string | null,
"supplier_name_free": string | null,
"task_occurrence_id": string | null,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "expenses"
        isOneToOne: true
        isSetofReturn: false
      } },
"has_site_access":
{ Args: { "p_site": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_task_assignee":
{ Args: { "p_task": string }; Returns: boolean
                           },
"notifications_mark_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"profile_deactivate":
{ Args: { "p_profile": string,"p_reason": string,"p_reassign_to"?: string }; Returns: Json
                           },
"profile_open_items":
{ Args: { "p_profile": string }; Returns: Json
                           },
"quote_duplicate":
{ Args: { "p_quote_id": string }; Returns: {
              "accepted_at": string | null,
"accepted_note": string | null,
"approved_version_no": number | null,
"client_contact_id": string | null,
"client_id": string,
"client_request_id": string | null,
"created_at": string,
"created_by": string,
"current_version_no": number,
"declaration_text": string | null,
"execution_deadline_text": string | null,
"id": string,
"inclusions_text": string | null,
"intro_text": string | null,
"issued_at": string,
"last_save_request_id": string | null,
"number": string,
"observations": string | null,
"payment_terms": string | null,
"service_location_text": string | null,
"site_id": string | null,
"status": string,
"status_reason": string | null,
"technical_notes": string | null,
"title": string | null,
"total_cents": number,
"updated_at": string,
"valid_until": string | null,
"warranty_text": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "quotes"
        isOneToOne: true
        isSetofReturn: false
      } },
"quote_link_photos":
{ Args: { "p_photo_ids": (string)[],"p_quote_id": string,"p_role": Database["public"]['Enums']["evidence_role"] }; Returns: number
                           },
"quote_save":
{ Args: { "p_client_request_id": string,"p_expected_updated_at"?: string,"p_header": Json,"p_items": Json,"p_quote_id"?: string }; Returns: {
              "accepted_at": string | null,
"accepted_note": string | null,
"approved_version_no": number | null,
"client_contact_id": string | null,
"client_id": string,
"client_request_id": string | null,
"created_at": string,
"created_by": string,
"current_version_no": number,
"declaration_text": string | null,
"execution_deadline_text": string | null,
"id": string,
"inclusions_text": string | null,
"intro_text": string | null,
"issued_at": string,
"last_save_request_id": string | null,
"number": string,
"observations": string | null,
"payment_terms": string | null,
"service_location_text": string | null,
"site_id": string | null,
"status": string,
"status_reason": string | null,
"technical_notes": string | null,
"title": string | null,
"total_cents": number,
"updated_at": string,
"valid_until": string | null,
"warranty_text": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "quotes"
        isOneToOne: true
        isSetofReturn: false
      } },
"quote_transition":
{ Args: { "p_accepted_on"?: string,"p_action": string,"p_quote_id": string,"p_reason"?: string,"p_snapshot"?: Json,"p_valid_until"?: string }; Returns: {
              "accepted_at": string | null,
"accepted_note": string | null,
"approved_version_no": number | null,
"client_contact_id": string | null,
"client_id": string,
"client_request_id": string | null,
"created_at": string,
"created_by": string,
"current_version_no": number,
"declaration_text": string | null,
"execution_deadline_text": string | null,
"id": string,
"inclusions_text": string | null,
"intro_text": string | null,
"issued_at": string,
"last_save_request_id": string | null,
"number": string,
"observations": string | null,
"payment_terms": string | null,
"service_location_text": string | null,
"site_id": string | null,
"status": string,
"status_reason": string | null,
"technical_notes": string | null,
"title": string | null,
"total_cents": number,
"updated_at": string,
"valid_until": string | null,
"warranty_text": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "quotes"
        isOneToOne: true
        isSetofReturn: false
      } },
"quote_unlink_photo":
{ Args: { "p_attachment_id": string,"p_quote_id": string }; Returns: undefined
                           },
"reimbursement_register_payment":
{ Args: { "p_amount_cents": number,"p_client_request_id"?: string,"p_expense_id": string,"p_notes"?: string,"p_paid_on"?: string,"p_payment_method_id"?: string }; Returns: {
              "amount_due_cents": number,
"amount_paid_cents": number,
"created_at": string,
"expense_id": string,
"id": string,
"payee_profile_id": string,
"settled_at": string | null,
"settled_by": string | null,
"settlement_notes": string | null,
"status": Database["public"]['Enums']["reimbursement_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "reimbursements"
        isOneToOne: true
        isSetofReturn: false
      } },
"report_publication_register":
{ Args: { "p_closing_version_id": string,"p_delivery_channel": string,"p_delivery_note"?: string,"p_report_artifact_id": string }; Returns: {
              "closing_version_id": string,
"delivery_channel": string | null,
"delivery_note": string | null,
"id": string,
"published_at": string,
"published_by": string | null,
"report_artifact_id": string | null,
"revoke_reason": string | null,
"revoked_at": string | null,
"revoked_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "report_publications"
        isOneToOne: true
        isSetofReturn: false
      } },
"report_publication_revoke":
{ Args: { "p_publication_id": string,"p_reason": string }; Returns: {
              "closing_version_id": string,
"delivery_channel": string | null,
"delivery_note": string | null,
"id": string,
"published_at": string,
"published_by": string | null,
"report_artifact_id": string | null,
"revoke_reason": string | null,
"revoked_at": string | null,
"revoked_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "report_publications"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_add_photos":
{ Args: { "p_client_request_id": string,"p_photo_ids": (string)[],"p_request_id": string,"p_role"?: Database["public"]['Enums']["evidence_role"] }; Returns: number
                           },
"request_cancel":
{ Args: { "p_client_request_id"?: string,"p_reason": string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_comment":
{ Args: { "p_body": string,"p_client_request_id": string,"p_is_internal"?: boolean,"p_request_id": string }; Returns: {
              "author_id": string,
"body": string,
"client_request_id": string,
"created_at": string,
"id": string,
"is_internal": boolean,
"service_request_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "request_comments"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_mark_executed":
{ Args: { "p_activity_date"?: string,"p_client_request_id": string,"p_description"?: string,"p_hours_worked"?: number,"p_materials"?: string,"p_participant_ids"?: (string)[],"p_photo_ids"?: (string)[],"p_request_id": string,"p_result_photo_ids": (string)[],"p_solution": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_open":
{ Args: { "p_channel"?: Database["public"]['Enums']["request_channel"],"p_client_request_id": string,"p_description": string,"p_due_date"?: string,"p_is_internal"?: boolean,"p_origin"?: Database["public"]['Enums']["request_origin"],"p_photo_ids"?: (string)[],"p_priority_id"?: string,"p_requester_contact_id"?: string,"p_requester_name"?: string,"p_service_category_id"?: string,"p_site_area_id"?: string,"p_site_id": string,"p_title": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_reopen":
{ Args: { "p_client_request_id"?: string,"p_reason": string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_report_pending":
{ Args: { "p_client_request_id": string,"p_expected_return_date": string,"p_explanation": string,"p_next_action": string,"p_next_action_owner_id": string,"p_pending_reason_id": string,"p_photo_ids"?: (string)[],"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_resume":
{ Args: { "p_client_request_id"?: string,"p_note"?: string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_return":
{ Args: { "p_client_request_id"?: string,"p_reason": string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_schedule":
{ Args: { "p_assignee_ids": (string)[],"p_client_request_id"?: string,"p_due_date"?: string,"p_priority_id"?: string,"p_reason"?: string,"p_request_id": string,"p_scheduled_date": string,"p_service_category_id"?: string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_start":
{ Args: { "p_client_request_id"?: string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_update":
{ Args: { "p_client_request_id"?: string,"p_description": string,"p_due_date": string,"p_expected_version"?: number,"p_is_internal": boolean,"p_priority_id": string,"p_reason"?: string,"p_request_id": string,"p_service_category_id": string,"p_site_area_id": string,"p_title": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_validate":
{ Args: { "p_client_request_id"?: string,"p_note"?: string,"p_request_id": string }; Returns: {
              "cancelled_at": string | null,
"channel": Database["public"]['Enums']["request_channel"] | null,
"client_id": string,
"client_request_id": string,
"closed_at": string | null,
"created_at": string,
"created_by": string,
"current_pending": Json | null,
"description": string,
"due_date": string | null,
"id": string,
"is_internal": boolean,
"number": string,
"opened_at": string,
"origin": Database["public"]['Enums']["request_origin"],
"priority_id": string | null,
"requester_contact_id": string | null,
"requester_name": string | null,
"scheduled_date": string | null,
"service_category_id": string | null,
"site_area_id": string | null,
"site_id": string,
"status": Database["public"]['Enums']["request_status"],
"task_id": string | null,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_add_occurrence":
{ Args: { "p_scheduled_date": string,"p_site_area_id"?: string,"p_site_id": string,"p_task_id": string }; Returns: {
              "created_at": string,
"finished_at": string | null,
"id": string,
"no_show_reason": string | null,
"notes": string | null,
"scheduled_date": string,
"site_area_id": string | null,
"site_id": string,
"sort_order": number,
"started_at": string | null,
"status": Database["public"]['Enums']["occurrence_status"],
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_occurrences"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_cancel":
{ Args: { "p_reason": string,"p_task_id": string }; Returns: {
              "cancel_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"client_request_id": string,
"created_at": string,
"created_by": string,
"description": string | null,
"due_date": string | null,
"id": string,
"kind_id": string | null,
"priority_id": string | null,
"scheduled_date": string,
"service_request_id": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_create":
{ Args: { "p_assignee_ids": (string)[],"p_client_request_id": string,"p_description"?: string,"p_due_date"?: string,"p_kind_id"?: string,"p_occurrences": Json,"p_priority_id"?: string,"p_scheduled_date": string,"p_service_request_id"?: string,"p_title": string }; Returns: {
              "cancel_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"client_request_id": string,
"created_at": string,
"created_by": string,
"description": string | null,
"due_date": string | null,
"id": string,
"kind_id": string | null,
"priority_id": string | null,
"scheduled_date": string,
"service_request_id": string | null,
"status": Database["public"]['Enums']["task_status"],
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_occurrence_finish":
{ Args: { "p_notes"?: string,"p_occurrence_id": string }; Returns: {
              "created_at": string,
"finished_at": string | null,
"id": string,
"no_show_reason": string | null,
"notes": string | null,
"scheduled_date": string,
"site_area_id": string | null,
"site_id": string,
"sort_order": number,
"started_at": string | null,
"status": Database["public"]['Enums']["occurrence_status"],
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_occurrences"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_occurrence_not_done":
{ Args: { "p_occurrence_id": string,"p_reason": string }; Returns: {
              "created_at": string,
"finished_at": string | null,
"id": string,
"no_show_reason": string | null,
"notes": string | null,
"scheduled_date": string,
"site_area_id": string | null,
"site_id": string,
"sort_order": number,
"started_at": string | null,
"status": Database["public"]['Enums']["occurrence_status"],
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_occurrences"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_occurrence_reschedule":
{ Args: { "p_occurrence_id": string,"p_reason": string,"p_scheduled_date": string }; Returns: {
              "created_at": string,
"finished_at": string | null,
"id": string,
"no_show_reason": string | null,
"notes": string | null,
"scheduled_date": string,
"site_area_id": string | null,
"site_id": string,
"sort_order": number,
"started_at": string | null,
"status": Database["public"]['Enums']["occurrence_status"],
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_occurrences"
        isOneToOne: true
        isSetofReturn: false
      } },
"task_occurrence_start":
{ Args: { "p_occurrence_id": string }; Returns: {
              "created_at": string,
"finished_at": string | null,
"id": string,
"no_show_reason": string | null,
"notes": string | null,
"scheduled_date": string,
"site_area_id": string | null,
"site_id": string,
"sort_order": number,
"started_at": string | null,
"status": Database["public"]['Enums']["occurrence_status"],
"task_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_occurrences"
        isOneToOne: true
        isSetofReturn: false
      } },
"time_entries_approve":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"time_entry_upsert":
{ Args: { "p_billable"?: boolean,"p_billing_units"?: number,"p_hours": number,"p_notes"?: string,"p_profile_id"?: string,"p_site_id": string,"p_work_date": string }; Returns: {
              "approved_at": string | null,
"approved_by": string | null,
"billable": boolean,
"billing_units": number,
"created_at": string,
"created_by": string | null,
"hours": number | null,
"id": string,
"notes": string | null,
"profile_id": string,
"site_id": string,
"source": string,
"updated_at": string,
"work_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"today_sp":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"work_entries_mark_reviewed":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"work_entry_adjust":
{ Args: { "p_activity_date": string,"p_client_visible": boolean,"p_description": string,"p_hours_worked": number,"p_materials": string,"p_reason": string,"p_solution": string,"p_work_entry_id": string }; Returns: {
              "activity_date": string,
"author_id": string,
"blocker_reason_id": string | null,
"client_request_id": string,
"client_visible": boolean,
"created_at": string,
"description": string,
"hours_worked": number | null,
"id": string,
"kind": Database["public"]['Enums']["work_kind"],
"materials": string | null,
"next_step": string | null,
"outcome": Database["public"]['Enums']["work_outcome"],
"review_status": Database["public"]['Enums']["work_review_status"],
"reviewed_at": string | null,
"reviewed_by": string | null,
"service_request_id": string | null,
"site_area_id": string | null,
"site_id": string,
"solution": string | null,
"submitted_payload": NonNullable<Json>,
"task_occurrence_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "work_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"work_entry_create":
{ Args: { "p_activity_date": string,"p_blocker_reason_id"?: string,"p_client_request_id": string,"p_description": string,"p_hours_worked"?: number,"p_kind"?: Database["public"]['Enums']["work_kind"],"p_materials"?: string,"p_next_step"?: string,"p_outcome"?: Database["public"]['Enums']["work_outcome"],"p_participant_ids"?: (string)[],"p_photo_ids"?: (string)[],"p_service_request_id"?: string,"p_site_area_id"?: string,"p_site_id": string,"p_solution"?: string,"p_task_occurrence_id"?: string }; Returns: {
              "activity_date": string,
"author_id": string,
"blocker_reason_id": string | null,
"client_request_id": string,
"client_visible": boolean,
"created_at": string,
"description": string,
"hours_worked": number | null,
"id": string,
"kind": Database["public"]['Enums']["work_kind"],
"materials": string | null,
"next_step": string | null,
"outcome": Database["public"]['Enums']["work_outcome"],
"review_status": Database["public"]['Enums']["work_review_status"],
"reviewed_at": string | null,
"reviewed_by": string | null,
"service_request_id": string | null,
"site_area_id": string | null,
"site_id": string,
"solution": string | null,
"submitted_payload": NonNullable<Json>,
"task_occurrence_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "work_entries"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "attachment_bucket": "evidence"|"receipts"|"reports"|"branding"|"quotes","attachment_entity": "service_request"|"work_entry"|"task_occurrence"|"expense"|"quote"|"site","attachment_visibility": "internal"|"client","client_kind": "pf"|"pj","evidence_role": "inicial"|"intermediaria"|"resultado"|"comprovante"|"local"|"referencia"|"documento"|"logo"|"assinatura","expense_review_action": "enviada"|"reenviada"|"editada"|"aprovada"|"devolvida"|"invalidada","expense_review_status": "rascunho"|"enviado_para_conferencia"|"aprovado"|"devolvido_para_correcao","occurrence_status": "prevista"|"iniciada"|"concluida"|"nao_realizada"|"cancelada","payer_kind": "empresa"|"colaborador","reimbursement_status": "pendente"|"parcial"|"quitado","request_channel": "portal"|"whatsapp"|"telefone"|"email"|"presencial"|"outro","request_event_type": "abertura"|"classificacao"|"atribuicao"|"reprogramacao"|"prorrogacao"|"inicio"|"atividade"|"pendencia"|"retomada"|"execucao_informada"|"devolucao"|"validacao"|"cancelamento"|"reabertura"|"comentario"|"anexo_adicionado"|"anexo_revogado"|"edicao","request_origin": "cliente_portal"|"cliente_externo"|"interna"|"programada","request_status": "aberta"|"programada"|"em_execucao"|"pendente"|"executada"|"concluida"|"cancelada","site_status": "ativa"|"pausada"|"encerrada","site_type": "obra_temporaria"|"unidade_recorrente","task_status": "planejada"|"em_andamento"|"concluida"|"cancelada","user_role": "admin"|"worker"|"foreman"|"client","work_kind": "execucao"|"visita"|"vistoria"|"recebimento_material"|"apoio"|"compra"|"outro","work_outcome": "executado"|"parcial"|"nao_executado","work_review_status": "enviado"|"revisado"|"ajustado"
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
            "attachment_bucket": ["evidence", "receipts", "reports", "branding", "quotes"],"attachment_entity": ["service_request", "work_entry", "task_occurrence", "expense", "quote", "site"],"attachment_visibility": ["internal", "client"],"client_kind": ["pf", "pj"],"evidence_role": ["inicial", "intermediaria", "resultado", "comprovante", "local", "referencia", "documento", "logo", "assinatura"],"expense_review_action": ["enviada", "reenviada", "editada", "aprovada", "devolvida", "invalidada"],"expense_review_status": ["rascunho", "enviado_para_conferencia", "aprovado", "devolvido_para_correcao"],"occurrence_status": ["prevista", "iniciada", "concluida", "nao_realizada", "cancelada"],"payer_kind": ["empresa", "colaborador"],"reimbursement_status": ["pendente", "parcial", "quitado"],"request_channel": ["portal", "whatsapp", "telefone", "email", "presencial", "outro"],"request_event_type": ["abertura", "classificacao", "atribuicao", "reprogramacao", "prorrogacao", "inicio", "atividade", "pendencia", "retomada", "execucao_informada", "devolucao", "validacao", "cancelamento", "reabertura", "comentario", "anexo_adicionado", "anexo_revogado", "edicao"],"request_origin": ["cliente_portal", "cliente_externo", "interna", "programada"],"request_status": ["aberta", "programada", "em_execucao", "pendente", "executada", "concluida", "cancelada"],"site_status": ["ativa", "pausada", "encerrada"],"site_type": ["obra_temporaria", "unidade_recorrente"],"task_status": ["planejada", "em_andamento", "concluida", "cancelada"],"user_role": ["admin", "worker", "foreman", "client"],"work_kind": ["execucao", "visita", "vistoria", "recebimento_material", "apoio", "compra", "outro"],"work_outcome": ["executado", "parcial", "nao_executado"],"work_review_status": ["enviado", "revisado", "ajustado"]
          }
        }
} as const
