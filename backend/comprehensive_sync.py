#!/usr/bin/env python3
"""
Comprehensive database and Go model synchronization analysis
"""

import os
import re
import subprocess
import json

def get_all_go_files():
    """Get all Go files in the project"""
    result = subprocess.run(['find', '.', '-name', '*.go'], capture_output=True, text=True)
    return result.stdout.strip().split('\n')

def extract_db_references(go_files):
    """Extract all database column references from Go code"""
    db_refs = set()
    
    for file_path in go_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                
                # Find db:"column_name" tags
                db_tags = re.findall(r'db:"([^"]+)"', content)
                for tag in db_tags:
                    if tag != '-':  # Ignore db:"-"
                        db_refs.add(tag)
                
                # Find SQL queries with column names
                sql_patterns = [
                    r'SELECT\s+([^FROM]+)\s+FROM',
                    r'INSERT\s+INTO\s+\w+\s*\(([^)]+)\)',
                    r'UPDATE\s+\w+\s+SET\s+([^WHERE]+)',
                ]
                
                for pattern in sql_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
                    for match in matches:
                        # Extract individual column names
                        columns = re.findall(r'\b([a-z_]+)\b', match)
                        for col in columns:
                            if len(col) > 2 and '_' in col:  # Likely a column name
                                db_refs.add(col)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return sorted(db_refs)

def get_database_columns():
    """Get actual database columns"""
    tables = {
        'admin_invitations': ['id','client_id','email','first_name','last_name','token','expires_at','status','invited_by','accepted_at','password_created_at','reminder_sent_count','last_reminder_sent','created_at','updated_at'],
        'chat_messages': ['id','meeting_id','sender_id','sender_email','sender_name','message','message_type','thread_id','message_status','edited_at','edited_by','original_message','reactions','mentions','file_attachments','message_priority','is_announcement','expires_at','translation_data','sentiment_score','flagged_content','flag_reason','metadata','is_moderated','moderated_by','moderated_at','reply_to_id','created_at','updated_at'],
        'client_features': ['id','client_id','chat_enabled','reactions_enabled','screen_sharing_enabled','recording_enabled','raise_hand_enabled','waiting_room_enabled','max_participants','admin_approval_required','default_video_permission','default_audio_permission','default_screen_permission','allow_user_video_request','allow_user_audio_request','allow_user_screen_request','auto_approve_requests','meeting_lobby_enabled','participant_limit','meeting_duration_limit','file_sharing_enabled','file_size_limit_mb','whiteboard_enabled','polls_enabled','q_and_a_enabled','live_streaming_enabled','meeting_templates_enabled','custom_backgrounds_enabled','noise_cancellation_enabled','transcription_enabled','translation_enabled','meeting_insights_enabled','api_access_enabled','webhook_notifications_enabled','sso_required','ip_restrictions','allowed_domains','blocked_domains','created_at','updated_at'],
        'clients': ['id','email','app_name','organization_name','organization_type','subscription_plan','subscription_expires_at','max_admins','max_users','max_concurrent_meetings','storage_limit_gb','logo_url','theme','primary_color','custom_domain','branding_config','sso_enabled','sso_config','security_settings','billing_contact_email','technical_contact_email','timezone','business_hours','is_active','trial_ends_at','created_by','created_at','updated_at'],
        'meetings': ['id','client_id','title','description','host_id','meeting_id','meeting_type','scheduled_start','scheduled_end','actual_start','actual_end','buffer_start_minutes','buffer_end_minutes','status','is_active','admin_only_controls','waiting_room_enabled','auto_admit_users','lock_meeting','mute_participants_on_join','disable_video_on_join','allow_screen_sharing','recording_auto_start','chat_enabled','raise_hand_enabled','breakout_rooms_enabled','max_duration_minutes','password','require_meeting_password','participant_join_approval','allow_anonymous_users','meeting_settings','lobby_message','entry_exit_chime','calendar_event_id','google_meet_link','zoom_meeting_id','teams_meeting_url','recording_consent_required','data_retention_days','meeting_notes','meeting_summary','quality_rating','feedback_comments','recurring_pattern','parent_meeting_id','occurrence_date','is_cancelled','cancellation_reason','cancelled_by','cancelled_at','created_by','created_at','updated_at'],
        'users': ['id','email','password_hash','first_name','last_name','role','status','client_id','invitation_token','invitation_expires_at','is_invited','password_created','two_factor_enabled','two_factor_secret','login_attempts','locked_until','password_reset_token','password_reset_expires','last_password_change','force_password_change','email_verified','email_verification_token','timezone','language','notification_preferences','created_by','created_at','updated_at'],
        'refresh_tokens': ['id','user_id','token','expires_at','created_at','updated_at'],
    }
    
    all_columns = set()
    for table, columns in tables.items():
        for col in columns:
            all_columns.add(col)
    
    return all_columns, tables

def analyze_mismatches():
    """Find mismatches between code references and actual database"""
    print("🔍 COMPREHENSIVE DATABASE-CODE SYNCHRONIZATION ANALYSIS\n")
    
    # Get Go files and extract references
    go_files = get_all_go_files()
    code_refs = extract_db_references(go_files)
    db_columns, db_tables = get_database_columns()
    
    print(f"📊 Found {len(code_refs)} database references in Go code")
    print(f"📊 Found {len(db_columns)} actual database columns")
    
    # Find references in code that don't exist in database
    missing_in_db = set(code_refs) - db_columns
    print(f"\n❌ COLUMNS REFERENCED IN CODE BUT MISSING IN DATABASE ({len(missing_in_db)}):")
    for col in sorted(missing_in_db):
        print(f"   - {col}")
        
        # Find which files reference this column
        for file_path in go_files:
            try:
                with open(file_path, 'r') as f:
                    if f'db:"{col}"' in f.read():
                        print(f"     Referenced in: {file_path}")
                        break
            except:
                pass
    
    # Find database columns not referenced in code
    missing_in_code = db_columns - set(code_refs)
    print(f"\n⚠️  DATABASE COLUMNS NOT REFERENCED IN CODE ({len(missing_in_code)}):")
    for col in sorted(missing_in_code):
        print(f"   - {col}")
        
        # Find which table this column belongs to
        for table, columns in db_tables.items():
            if col in columns:
                print(f"     Found in table: {table}")
                break
    
    # Generate specific recommendations
    print(f"\n🚀 SPECIFIC RECOMMENDATIONS:")
    
    critical_missing = [col for col in missing_in_db if col in [
        'profile_picture', 'last_login', 'created_by_user_id', 'recurring_id',
        'enable_waiting_room', 'enable_chat', 'enable_screen_sharing', 'enable_recording'
    ]]
    
    if critical_missing:
        print(f"\n🔥 CRITICAL: These columns are referenced in core functionality but missing:")
        for col in critical_missing:
            print(f"   - {col}")
    
    print(f"\n📝 ACTION ITEMS:")
    print(f"   1. Add missing database columns: {len(missing_in_db)} items")
    print(f"   2. Update Go models with unused DB columns: {len(missing_in_code)} items")
    print(f"   3. Review and fix critical missing columns: {len(critical_missing)} items")
    
    return {
        'missing_in_db': missing_in_db,
        'missing_in_code': missing_in_code,
        'critical_missing': critical_missing
    }

if __name__ == "__main__":
    results = analyze_mismatches()