import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zoxdnsjhdpdhwyxbluax.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpveGRuc2poZHBkaHd5eGJsdWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzU0ODIsImV4cCI6MjA5ODUxMTQ4Mn0.Tb_TKnYsIroEmmjoIFLJcQCrtCZw3AlUWHf6dzj_4g0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};
