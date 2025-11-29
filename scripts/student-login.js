// ====================================================
// SUPABASE CONFIGURATION
// ====================================================
const SUPABASE_URL = 'https://zlkleprvhjgjcjycezpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsa2xlcHJ2aGpnamNqeWNlenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzAyNDcsImV4cCI6MjA3Nzc0NjI0N30.e1LkaKKXfDUOHOh1Oi6GY1lwpd5DZ5R-FkSP62XXGD0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================
// DOM ELEMENTS
// ====================================================
const loginForm = document.getElementById('student-login-form');
const submitButton = document.getElementById('submit-btn');
const errorDiv = document.getElementById('error-message');
const collegeSelect = document.getElementById('college_id');
const rollNumberInput = document.getElementById('roll_number');

// ====================================================
// INITIALIZATION
// ====================================================

/**
 * Fetches colleges and populates the dropdown
 */
async function populateColleges() {
    try {
        const { data, error } = await db.from('colleges')
            .select('id, name')
            .order('name');
        
        if (error) throw error;

        collegeSelect.innerHTML = ''; // Clear "Loading..."
        collegeSelect.appendChild(new Option('Select your college', ''));

        data.forEach(college => {
            collegeSelect.appendChild(new Option(college.name, college.id));
        });

    } catch (error) {
        console.error('Error fetching colleges:', error);
        collegeSelect.innerHTML = '';
        collegeSelect.appendChild(new Option('Error loading colleges', ''));
        collegeSelect.disabled = true;
    }
}

// Run on page load
window.addEventListener('load', () => {
    populateColleges();
});

// ====================================================
// EVENT LISTENERS
// ====================================================

/**
 * Enable roll number input only when a college is selected
 */
collegeSelect.addEventListener('change', () => {
    if (collegeSelect.value) {
        rollNumberInput.disabled = false;
        rollNumberInput.placeholder = 'Enter your roll number';
    } else {
        rollNumberInput.disabled = true;
        rollNumberInput.placeholder = 'Select your college first';
    }
});

/**
 * Handle the login form submission
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    showError(null); // Clear previous errors

    const rollNumber = rollNumberInput.value.trim();
    const collegeId = collegeSelect.value;

    // --- Validation ---
    if (!collegeId) {
        showError('Please select your college.');
        setLoading(false);
        return;
    }
    if (!rollNumber) {
        showError('Please enter your roll number.');
        setLoading(false);
        return;
    }

    try {
        // Find the student using BOTH college_id and roll_number
        const { data, error } = await db.from('students')
            .select('id, name')
            .eq('roll_number', rollNumber)
            .eq('college_id', collegeId); // <-- This is the key change

        if (error) throw error;

        if (data.length === 0) {
            showError('Student not found. Please check your college and roll number.');
            setLoading(false);
            return;
        }

        // Student found!
        const student = data[0];
        
        // Store the student's ID in localStorage to "log them in"
        localStorage.setItem('student_id', student.id);
        localStorage.setItem('student_name', student.name);

        // Redirect to the dashboard
        window.location.href = '/student-dashboard.html';

    } catch (error) {
        console.error('Login Error:', error);
        showError(`An error occurred: ${error.message}`);
        setLoading(false);
    }
});

// ====================================================
// HELPER FUNCTIONS
// ====================================================
function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Loading...' : 'Enter';
}

function showError(message) {
    if (message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    } else {
        errorDiv.classList.add('hidden');
    }
}