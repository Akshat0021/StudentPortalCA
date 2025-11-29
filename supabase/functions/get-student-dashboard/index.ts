// supabase/functions/get-student-dashboard/index.ts
// (REVISED WITH THE CORRECT QUERY)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { studentId } = await req.json()
    if (!studentId || studentId === "null" || studentId === "undefined") {
      throw new Error("Missing or invalid student_id")
    }

    // 1. Get secrets and create admin client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Server is missing environment variables (URL or Service Key).")
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // 2. Get student's groups and college ID
    const { data: studentProfile, error: profileError } = await supabase
      .from('students')
      .select('college_id, student_group_members(group_id)')
      .eq('id', studentId)
      .single()

    if (profileError) throw profileError
    if (!studentProfile) {
      throw new Error(`Student profile not found for ID: ${studentId}`)
    }

    const collegeId = studentProfile.college_id
    
    // *** SAFER CHECK ***
    const groupIds = Array.isArray(studentProfile.student_group_members)
      ? studentProfile.student_group_members.map((g: any) => g.group_id)
      : []

    let schedulesData = []
    if (groupIds.length > 0) {
      // Only fetch schedules if the student is in at least one group
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedule_groups')
        .select('schedules!inner(*, courses(*))')
        .in('group_id', groupIds)
      
      if (schedulesError) throw schedulesError
      schedulesData = schedules || []
    }

   // 3. Fetch other data in parallel
    const [attendanceRes, holidaysRes] = await Promise.all([
      supabase.from('attendance')
        // CHANGE THIS LINE: Use the table name 'schedules', not the column 'schedule_id'
        .select('*, schedules(*)')
        .eq('student_id', studentId),
      
      supabase.from('holidays')
        .select('holiday_date, description')
        .eq('college_id', collegeId)
    ])

    if (attendanceRes.error) throw attendanceRes.error
    if (holidaysRes.error) throw holidaysRes.error

    // 4. Return all data in one payload
    const payload = {
      attendanceRecords: attendanceRes.data || [],
      schedules: schedulesData,
      holidays: holidaysRes.data || [],
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // Return a 500 error with the *actual* error message
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})