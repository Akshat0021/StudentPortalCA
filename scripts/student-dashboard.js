// ====================================================
// SUPABASE CONFIGURATION
// ====================================================
const SUPABASE_URL = 'https://zlkleprvhjgjcjycezpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsa2xlcHJ2aGpnamNqeWNlenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzAyNDcsImV4cCI6MjA3Nzc0NjI0N30.e1LkaKKXfDUOHOh1Oi6GY1lwpd5DZ5R-FkSP62XXGD0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================
// GLOBAL STATE
// ====================================================
let studentId = null;

// ====================================================
// INITIALIZATION
// ====================================================
window.addEventListener('load', () => {
    studentId = localStorage.getItem('student_id');
    const studentName = localStorage.getItem('student_name');

    if (!studentId) {
        window.location.href = '/student-login.html';
        return;
    }

    document.getElementById('student-name-display').textContent = studentName || 'Student';
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('student_id');
        localStorage.removeItem('student_name');
        window.location.href = '/student-login.html';
    });

    loadDashboardData();
});

async function loadDashboardData() {
    try {
        // 1. Call the new Edge Function
        // This securely gets all data using the student_id
        const { data, error } = await db.functions.invoke('get-student-dashboard', {
            body: { studentId: studentId }
        });

        // The 'data' object is the payload we returned from the function
        if (error) throw error;
        if (data.error) throw new Error(data.error);

        // 2. Process and display the data
        // The display functions are the same, they just receive the data from our function
        displayAttendanceMetrics(data.attendanceRecords || [], data.schedules || []);
        displayWeeklyPlanner(data.schedules || [], data.holidays || []);

    } catch (error) {
        console.error("Error loading dashboard:", error);
        document.getElementById('loading-courses').textContent = `Error loading data: ${error.message}`;
        document.getElementById('loading-schedule').textContent = `Error loading data: ${error.message}`;
    }
}

// ====================================================
// ATTENDANCE METRICS
// (This function is UNCHANGED)
// ====================================================
function displayAttendanceMetrics(attendanceRecords, scheduleGroups) {
    const courseStats = {};
    const courseNameMap = new Map();

    // 1. Map all courses the student is part of
    scheduleGroups.forEach(sg => {
        const course = sg.schedules.courses;
        if (course && !courseNameMap.has(course.id)) {
            courseNameMap.set(course.id, course.name);
            courseStats[course.id] = {
                name: course.name,
                total: 0,
                attended: 0,
                monthlyTotal: 0,
                monthlyAttended: 0
            };
        }
    });

    // 2. Process attendance records
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (const record of attendanceRecords) {
        // Find the course this attendance record belongs to
        if (!record.schedules || !record.schedules.course_id) {
            continue; // Skip records not linked to a course schedule
        }
        
        const courseId = record.schedules.course_id;

        if (courseStats[courseId]) {
            const isPresent = (record.status === 'present' || record.status === 'late');
            
            // Add to All-Time stats
            courseStats[courseId].total++;
            if (isPresent) {
                courseStats[courseId].attended++;
            }

            // Check if it's from the current month
            const recordDate = new Date(record.date);
            if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                courseStats[courseId].monthlyTotal++;
                if (isPresent) {
                    courseStats[courseId].monthlyAttended++;
                }
            }
        }
    }

    // 3. Calculate and display percentages
    let grandTotal = 0;
    let grandAttended = 0;
    let grandMonthlyTotal = 0;
    let grandMonthlyAttended = 0;

    const tbody = document.getElementById('course-breakdown-body');
    tbody.innerHTML = ''; // Clear loading state

    for (const courseId in courseStats) {
        const stats = courseStats[courseId];
        grandTotal += stats.total;
        grandAttended += stats.attended;
        grandMonthlyTotal += stats.monthlyTotal;
        grandMonthlyAttended += stats.monthlyAttended;

        const overallPercent = (stats.total > 0) ? (stats.attended / stats.total) * 100 : 0;
        const monthlyPercent = (stats.monthlyTotal > 0) ? (stats.monthlyAttended / stats.monthlyTotal) * 100 : 0;

        const row = `
            <tr class="border-b border-gray-100">
                <td class="py-4 px-4 font-medium text-gray-900">${stats.name}</td>
                <td class="py-4 px-4 text-center">
                    <span class="font-bold">${overallPercent.toFixed(1)}%</span>
                    <span class="text-sm text-gray-500">(${stats.attended}/${stats.total})</span>
                </td>
                <td class="py-4 px-4 text-center">
                    <span class="font-bold">${monthlyPercent.toFixed(1)}%</span>
                    <span class="text-sm text-gray-500">(${stats.monthlyAttended}/${stats.monthlyTotal})</span>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    }
     // Handle case where no courses were found
    if (Object.keys(courseStats).length === 0) {
        document.getElementById('loading-courses').textContent = 'No courses found for this student.';
    } else {
        document.getElementById('loading-courses').classList.add('hidden');
        document.getElementById('courses-table').classList.remove('hidden');
    }


    // 4. Display overall metrics
    const overallCombinedPercent = (grandTotal > 0) ? (grandAttended / grandTotal) * 100 : 0;
    const monthlyCombinedPercent = (grandMonthlyTotal > 0) ? (grandMonthlyAttended / grandMonthlyTotal) * 100 : 0;

    document.getElementById('overall-percentage').textContent = `${overallCombinedPercent.toFixed(1)}%`;
    document.getElementById('monthly-overall-percentage').textContent = `${monthlyCombinedPercent.toFixed(1)}%`;
}

// ====================================================
// WEEKLY PLANNER
// (This function is UNCHANGED)
// ====================================================
function displayWeeklyPlanner(scheduleGroups, holidays) {
    const scheduleByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    
    // 1. Group schedules by day of the week
    scheduleGroups.forEach(sg => {
        const schedule = sg.schedules;
        if (schedule) {
            scheduleByDay[schedule.day_of_week].push(schedule);
        }
    });

    // 2. Sort classes within each day by start time
    for (const day in scheduleByDay) {
        scheduleByDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    // 3. Create a map of holidays for quick lookup
    const holidayMap = new Map(holidays.map(h => [h.holiday_date, h.description]));

    // 4. Build the table
    const tbody = document.getElementById('schedule-body');
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const todayDayIndex = today.getDay();
    tbody.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const dayIndex = (todayDayIndex + i) % 7; // Start from today
        const dayName = daysOfWeek[dayIndex];
        
        // Check if this day is a holiday
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() + i);
        const dateString = dayDate.toISOString().split('T')[0];
        const holiday = holidayMap.get(dateString);

        const row = document.createElement('tr');
        row.className = (dayIndex === todayDayIndex) ? 'bg-indigo-50 border-b border-indigo-100' : 'border-b border-gray-100';

        let classHtml = '';
        if (holiday) {
            classHtml = `<div class="p-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium">${holiday}</div>`;
        } else {
            const classes = scheduleByDay[dayIndex];
            if (classes.length === 0) {
                classHtml = `<span class="text-gray-400">No classes scheduled</span>`;
            } else {
                classHtml = classes.map(c => `
                    <div class="mb-2 p-2 bg-blue-50 rounded-lg">
                        <div class="font-semibold text-blue-800">${c.courses.name}</div>
                        <div class="text-sm text-gray-600">${formatTime(c.start_time)} - ${formatTime(c.end_time)}</div>
                    </div>
                `).join('');
            }
        }
        
        row.innerHTML = `
            <td class="py-3 px-4 font-medium">${dayName} <span class="text-sm text-gray-500">${i === 0 ? '(Today)' : ''}</span></td>
            <td class="py-3 px-4">${classHtml}</td>
        `;
        tbody.appendChild(row);
    }

    document.getElementById('loading-schedule').classList.add('hidden');
    document.getElementById('schedule-table').classList.remove('hidden');
}

function formatTime(timeStr) {
    if (!timeStr) return 'N/A';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr.replace(/^0+/, ''); // remove leading zero if any
    const [hours, minutes] = parts;
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}