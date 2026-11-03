import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NjAyODUsImV4cCI6MjEwOTIzNjI4NX0.FTu7uZr6VKd_P44jnZMU-ig0xAGpBye_7JmWsPtjBf8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

