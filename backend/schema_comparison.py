#!/usr/bin/env python3
"""
Script to compare database schemas with Go models and generate migration recommendations
"""

import re
import json

# Database tables and their columns (from database_tables_columns.txt)
DB_TABLES = {
    'admin_invitations': ['id','client_id','email','first_name','last_name','token','expires_at','status','invited_by','accepted_at','password_created_at','reminder_sent_count','last_reminder_sent','created_at','updated_at'],
    'chat_messages': ['id','meeting_id','sender_id','sender_email','sender_name','message','message_type','thread_id','message_status','edited_at','edited_by','original_message','reactions','mentions','file_attachments','message_priority','is_announcement','expires_at','translation_data','sentiment_score','flagged_content','flag_reason','metadata','is_moderated','moderated_by','moderated_at','reply_to_id','created_at','updated_at'],
    'client_features': ['id','client_id','chat_enabled','reactions_enabled','screen_sharing_enabled','recording_enabled','raise_hand_enabled','waiting_room_enabled','max_participants','admin_approval_required','default_video_permission','default_audio_permission','default_screen_permission','allow_user_video_request','allow_user_audio_request','allow_user_screen_request','auto_approve_requests','meeting_lobby_enabled','participant_limit','meeting_duration_limit','file_sharing_enabled','file_size_limit_mb','whiteboard_enabled','polls_enabled','q_and_a_enabled','live_streaming_enabled','meeting_templates_enabled','custom_backgrounds_enabled','noise_cancellation_enabled','transcription_enabled','translation_enabled','meeting_insights_enabled','api_access_enabled','webhook_notifications_enabled','sso_required','ip_restrictions','allowed_domains','blocked_domains','created_at','updated_at'],
    'clients': ['id','email','app_name','organization_name','organization_type','subscription_plan','subscription_expires_at','max_admins','max_users','max_concurrent_meetings','storage_limit_gb','logo_url','theme','primary_color','custom_domain','branding_config','sso_enabled','sso_config','security_settings','billing_contact_email','technical_contact_email','timezone','business_hours','is_active','trial_ends_at','created_by','created_at','updated_at'],
    'email_templates': ['id','client_id','type','name','subject','html_body','text_body','variables','is_default','is_active','created_by','created_at','updated_at'],
    'groups': ['id','client_id','name','description','group_type','is_active','max_members','auto_add_new_users','email_domain_filter','group_settings','meeting_defaults','notification_settings','external_id','sync_source','last_sync_at','sync_errors','created_by','created_at','updated_at'],
    'meeting_analytics': ['id','meeting_id','participant_count','peak_participants','total_duration_seconds','chat_messages_count','screen_shares_count','recordings_count','raise_hands_count','permission_requests_count','average_participant_duration','participant_join_times','participant_leave_times','feature_usage_stats','quality_metrics','created_at','updated_at'],
    'meeting_participant_extended': ['id','meeting_participant_id','connection_quality','device_info','browser_info','network_info','permissions_granted','speaking_time_seconds','chat_messages_sent','reactions_sent','screen_share_duration','hand_raises_count','last_activity_at','created_at','updated_at'],
    'meeting_participants': ['id','meeting_id','user_id','group_id','email','guest_name','role','status','joined_at','left_at','invited_by','invited_at'],
    'meeting_permissions': ['id','meeting_id','user_id','permission_type','is_granted','requested_at','approved_at','denied_at','approved_by','denied_by','request_message','admin_response','auto_granted','created_at','updated_at'],
    'meetings': ['id','client_id','title','description','host_id','meeting_id','meeting_type','scheduled_start','scheduled_end','actual_start','actual_end','buffer_start_minutes','buffer_end_minutes','status','is_active','admin_only_controls','waiting_room_enabled','auto_admit_users','lock_meeting','mute_participants_on_join','disable_video_on_join','allow_screen_sharing','recording_auto_start','chat_enabled','raise_hand_enabled','breakout_rooms_enabled','max_duration_minutes','password','require_meeting_password','participant_join_approval','allow_anonymous_users','meeting_settings','lobby_message','entry_exit_chime','calendar_event_id','google_meet_link','zoom_meeting_id','teams_meeting_url','recording_consent_required','data_retention_days','meeting_notes','meeting_summary','quality_rating','feedback_comments','recurring_pattern','parent_meeting_id','occurrence_date','is_cancelled','cancellation_reason','cancelled_by','cancelled_at','created_by','created_at','updated_at'],
    'raise_hands': ['id','meeting_id','user_id','raised_at','lowered_at','lowered_by','auto_lowered','acknowledged_by','acknowledged_at','queue_position','created_at'],
    'recordings': ['id','meeting_id','title','description','status','started_at','ended_at','duration','file_size','file_path','download_url','streaming_url','metadata','settings','started_by','stopped_by','is_public','password','expires_at','created_at','updated_at'],
    'refresh_tokens': ['id','user_id','token','expires_at','created_at','updated_at'],
    'speaking_activity': ['id','meeting_id','user_id','started_speaking_at','stopped_speaking_at','duration_seconds','audio_level_avg','audio_level_peak','created_at'],
    'user_analytics': ['id','user_id','client_id','total_meetings_joined','total_meeting_duration_minutes','total_speaking_time_minutes','total_chat_messages','meetings_this_week','meetings_this_month','average_meeting_duration','most_active_day_of_week','most_active_hour','engagement_score','last_meeting_date','first_meeting_date','preferred_meeting_duration','participation_trends','feature_usage_stats','device_preferences','created_at','updated_at'],
    'user_group_memberships': ['id','user_id','group_id','added_by','added_at'],
    'user_invitations': ['id','client_id','admin_id','email','first_name','last_name','token','expires_at','status','welcome_message','accepted_at','password_created_at','reminder_sent_count','last_reminder_sent','created_at','updated_at'],
    'user_meeting_bookmarks': ['id','user_id','meeting_id','bookmark_time_seconds','bookmark_title','bookmark_description','bookmark_type','is_private','created_at','updated_at'],
    'user_preferences': ['id','user_id','default_audio_enabled','default_video_enabled','auto_join_audio','preferred_camera_device','preferred_microphone_device','preferred_speaker_device','notification_email_enabled','notification_browser_enabled','notification_meeting_reminders','notification_chat_messages','notification_meeting_invites','theme_preference','language_preference','timezone_preference','meeting_view_preference','chat_position','show_participant_names','show_connection_quality','auto_hide_controls','keyboard_shortcuts_enabled','high_contrast_mode','reduce_motion','created_at','updated_at'],
    'users': ['id','email','password_hash','first_name','last_name','role','status','client_id','invitation_token','invitation_expires_at','is_invited','password_created','two_factor_enabled','two_factor_secret','login_attempts','locked_until','password_reset_token','password_reset_expires','last_password_change','force_password_change','email_verified','email_verification_token','timezone','language','notification_preferences','created_by','created_at','updated_at']
}

# Go models and their rough mappings (from go_models.txt - this would need manual inspection)
GO_MODELS = {
    'AdminInvitation': 'admin_invitations',
    'UserInvitation': 'user_invitations', 
    'MeetingPermission': 'meeting_permissions',
    'RaiseHand': 'raise_hands',
    'MeetingAnalytics': 'meeting_analytics',
    'SpeakingActivity': 'speaking_activity',
    'UserAnalytics': 'user_analytics',
    'UserPreferences': 'user_preferences',
    'UserMeetingBookmark': 'user_meeting_bookmarks',
    'MeetingParticipantExtended': 'meeting_participant_extended',
    'Client': 'clients',
    'ClientFeatures': 'client_features',
    'User': 'users',
    'Group': 'groups',
    'UserGroupMembership': 'user_group_memberships',
    'Meeting': 'meetings',
    'Invitation': None,  # No direct table mapping
    'EmailTemplate': 'email_templates',
    'ChatMessage': 'chat_messages',
    'Recording': 'recordings',
    'MeetingParticipant': 'meeting_participants',
    'RefreshToken': 'refresh_tokens',
}

def analyze_schema_differences():
    """Compare database tables with Go models"""
    print("=== SCHEMA COMPARISON ANALYSIS ===\n")
    
    # Find tables without Go models
    print("📋 Database tables WITHOUT corresponding Go models:")
    tables_without_models = []
    for table in DB_TABLES.keys():
        if table not in GO_MODELS.values():
            tables_without_models.append(table)
            print(f"  ❌ {table}")
    
    print(f"\nTotal: {len(tables_without_models)} tables without models\n")
    
    # Find Go models without database tables
    print("🔧 Go models WITHOUT corresponding database tables:")
    models_without_tables = []
    for model, table in GO_MODELS.items():
        if table and table not in DB_TABLES:
            models_without_tables.append(model)
            print(f"  ❌ {model} -> {table}")
    
    print(f"\nTotal: {len(models_without_tables)} models without tables\n")
    
    # Find matching pairs that need field comparison
    print("🔍 Models/Tables that exist in both (need field comparison):")
    matching_pairs = []
    for model, table in GO_MODELS.items():
        if table and table in DB_TABLES:
            matching_pairs.append((model, table))
            print(f"  ✅ {model} <-> {table}")
    
    print(f"\nTotal: {len(matching_pairs)} matching pairs\n")
    
    return {
        'tables_without_models': tables_without_models,
        'models_without_tables': models_without_tables,
        'matching_pairs': matching_pairs
    }

def generate_migration_strategy(analysis):
    """Generate migration recommendations"""
    print("🚀 MIGRATION STRATEGY RECOMMENDATIONS:\n")
    
    print("1. CREATE MISSING GO MODELS:")
    for table in analysis['tables_without_models']:
        cols = DB_TABLES[table]
        print(f"   - Create Go model for '{table}' table with {len(cols)} fields")
    
    print("\n2. CREATE MISSING DATABASE TABLES:")  
    for model in analysis['models_without_tables']:
        print(f"   - Create database table for '{model}' Go model")
    
    print("\n3. SYNC EXISTING MODEL/TABLE PAIRS:")
    for model, table in analysis['matching_pairs']:
        cols = DB_TABLES[table]
        print(f"   - Review {model} <-> {table} ({len(cols)} DB columns)")
        
    print("\n4. IMMEDIATE PRIORITIES:")
    print("   🔥 HIGH: Client, ClientFeatures, User, Meeting models (core functionality)")
    print("   🟡 MED: ChatMessage, Recording, UserPreferences models")  
    print("   🟢 LOW: Analytics and extended models")
    
    print("\n5. IMPLEMENTATION APPROACH:")
    print("   📝 Phase 1: Update core models (Client, User, Meeting) to match DB")
    print("   📝 Phase 2: Create missing models for existing tables")
    print("   📝 Phase 3: Review and optimize field mappings")
    print("   📝 Phase 4: Add proper validation and constraints")

if __name__ == "__main__":
    analysis = analyze_schema_differences()
    generate_migration_strategy(analysis)