// Sky Sports Raw Data → Table Generator
// WARNING: API key is in JS for development only. REMOVE before production!
// const OPENAI_API_KEY = "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";

const OPENAI_API_URL = '/api/openai-proxy';

const INSTRUCTION_SET = `You are an expert at converting raw Sky Sports UK schedule data into a structured table for Google Sheets.

INSTRUCTIONS:
- Only use the USER INPUT section below for generating the table.
- Do NOT use any example data or previous examples, even if the input is empty or unclear.
- If the input does not look like valid Sky Sports schedule data (e.g., it does not contain sports, dates, or event listings), return: {"events": []}
- Output ONLY valid JSON as described below, and nothing else.

DATA FORMATTING RULES:
- Parse the date and day from lines like "Fri 23rd May".
- Detect sport headers (e.g., Football, Cricket, Formula 1, Tennis, etc.).
- Extract event lines and supporting info (times, descriptions).
- Use the earliest time listed for each event.
- Estimate event durations by sport (see below).
- Format event names as per the rules below.
- Omit channel names completely.
- Keep the original order of events.
- Output a table with exactly 11 columns: Date, Day, Sky UK, Linear, Event Type, [4 empty columns], Start Time, End Time.
- Insert 4 empty columns between Event Type and Start Time.
- Times must be in HH:MM:SS format.
- Use "Sky UK" for the Sky UK column and "Linear" for the Linear column.

EVENT NAME FORMATTING:
- Football: "Football: [Team A] v [Team B]"
- Cricket: "Cricket: [Team A] v [Team B] (Format)" if format is present
- Tennis: "Tennis: [Event List]" (merge multiple tours into one line, no 'Live Tennis:' prefix)
- Golf: "Golf: [Tour]: [Event Name]"
- Formula 1: "Formula 1: [Event Name]"
- Netball NSL: Use "NSL:" (not "Netball: NSL")
- For other sports, use "[Sport]: [Event Name]"

EVENT DURATION ESTIMATES:
- Football: 2 hours
- Cricket T20: 3 hours
- Cricket ODI: 5 hours
- Cricket Test/One-off Test: 8 hours
- Rugby: 2 hours
- Tennis: 4.5 hours
- Golf: 5 hours
- Formula 1 Race: 2 hours
- Formula 1 Practice/Quali: 1 hour
- Darts Premier League: 3 hours
- Netball Match: 2 hours

OUTPUT FORMAT:
Return ONLY valid JSON in this format:
{
  "events": [
    {
      "date": "DD MMM YYYY",
      "day": "3-letter weekday",
      "skyDE": "Sky UK",
      "linear": "Linear",
      "eventType": "formatted event name per rules above",
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS"
    }
  ]
}

USER INPUT:
[USER_INPUT_HERE]`;

// DOM Elements
const rawDataInput = document.getElementById('raw-data-input');
const generateBtn = document.getElementById('generate-table-button');
const clearBtn = document.getElementById('clear-input-button');
const tableContainer = document.getElementById('table-container');
const copyBtn = document.getElementById('copy-table-btn');
const copyBtnContainer = document.getElementById('copy-btn-container');
const errorContainer = document.getElementById('error-message-container');
const helpModalBtn = document.getElementById('help-modal-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = document.getElementById('close-help-modal');
const closeHelpModalBtn = document.getElementById('close-help-modal-btn');

// --- Dark Mode Logic ---
const themeToggle = document.getElementById('theme-toggle');
function setTheme(mode) {
    if (mode === 'light') {
        document.body.classList.add('light-mode');
        themeToggle.checked = true;
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-mode');
        themeToggle.checked = false;
        localStorage.setItem('theme', 'dark');
    }
}
themeToggle.addEventListener('change', () => {
    setTheme(themeToggle.checked ? 'light' : 'dark');
});
(function initTheme() {
    const saved = localStorage.getItem('theme');
    setTheme(saved === 'light' ? 'light' : 'dark');
})();

// --- Time Adjust Logic ---
let currentEvents = null; // Store the last events array for time adjustment
const timeAdjustGroup = document.getElementById('time-adjust-group');
const addHourBtn = document.getElementById('add-hour-btn');
const reduceHourBtn = document.getElementById('reduce-hour-btn');

function parseDate(dateStr, dayStr) {
    // dateStr: '22 May 2025', dayStr: 'Thu'
    // Returns JS Date object
    const [d, m, y] = dateStr.split(' ');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIdx = months.findIndex(mon => mon.toLowerCase() === m.toLowerCase());
    return new Date(Number(y), monthIdx, Number(d));
}
function formatDate(dateObj) {
    // Returns {date: 'DD MMM YYYY', day: 'Thu'}
    const d = dateObj.getDate().toString().padStart(2, '0');
    const m = dateObj.toLocaleString('en-GB', { month: 'short' });
    const y = dateObj.getFullYear();
    const day = dateObj.toLocaleString('en-GB', { weekday: 'short' });
    return { date: `${d} ${m} ${y}`, day };
}
function adjustHour(events, delta) {
    // Returns a new events array with times adjusted by delta hours
    return events.map(ev => {
        // Parse date and time
        let dateObj = parseDate(ev.date, ev.day);
        let [h, m, s] = (ev.startTime || '00:00:00').split(':').map(Number);
        let start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, m, s);
        [h, m, s] = (ev.endTime || '00:00:00').split(':').map(Number);
        let end = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, m, s);
        // Adjust
        start.setHours(start.getHours() + delta);
        end.setHours(end.getHours() + delta);
        // If start or end cross midnight, update date and day
        const startFmt = formatDate(start);
        const endFmt = formatDate(end);
        // If start and end are on different days, use start's date for both (to keep table row logic simple)
        return {
            ...ev,
            date: startFmt.date,
            day: startFmt.day,
            startTime: start.toTimeString().slice(0,8),
            endTime: end.toTimeString().slice(0,8)
        };
    });
}
addHourBtn.addEventListener('click', () => {
    if (!currentEvents) return;
    currentEvents = adjustHour(currentEvents, 1);
    renderTableFromEvents(currentEvents);
});
reduceHourBtn.addEventListener('click', () => {
    if (!currentEvents) return;
    currentEvents = adjustHour(currentEvents, -1);
    renderTableFromEvents(currentEvents);
});

// --- EventType Post-Processing ---
function cleanEventType(evType) {
    if (!evType) return '';
    // Remove 'Tennis: Live Tennis:' or 'Live Tennis:'
    evType = evType.replace(/^Tennis: Live Tennis:/i, 'Tennis:').replace(/^Live Tennis:/i, 'Tennis:');
    // Remove duplicate 'Tennis: Tennis:'
    evType = evType.replace(/^Tennis: Tennis:/i, 'Tennis:');
    // Netball: NSL -> NSL:
    evType = evType.replace(/^Netball: NSL/i, 'NSL:');
    // Remove extra spaces after colons
    evType = evType.replace(/:\s+/g, ': ');
    return evType.trim();
}

// Helper: Show error
function showError(msg) {
    errorContainer.innerHTML = `<div class="error-message">${msg}</div>`;
    setTimeout(() => {
        const err = errorContainer.querySelector('.error-message');
        if (err) err.classList.add('fade-out');
        setTimeout(() => { errorContainer.innerHTML = ''; }, 400);
    }, 3500);
}

// Helper: Show loading spinner in table area
function showLoading() {
    tableContainer.innerHTML = `<div class="placeholder-text">Generating table... <span style="font-size:1.3em">⏳</span></div>`;
    copyBtnContainer.classList.add('hidden');
}

// Helper: Show placeholder
function showPlaceholder() {
    tableContainer.innerHTML = `<div class="placeholder-text">No table generated yet. Paste raw data and click Generate.</div>`;
    copyBtnContainer.classList.add('hidden');
}

// Helper: Render table from events array (with cleaning)
function renderTableFromEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
        showError('No events found in AI response.');
        showPlaceholder();
        timeAdjustGroup.classList.add('hidden');
        return;
    }
    currentEvents = events.map(ev => ({ ...ev, eventType: cleanEventType(ev.eventType) }));
    let html = '<table><thead><tr>';
    html += '<th>Date</th><th>Day</th><th>Sky UK</th><th>Linear</th><th>Event Type</th>';
    for (let i = 0; i < 4; ++i) html += '<th class="empty-placeholder"></th>';
    html += '<th>Start Time</th><th>End Time</th>';
    html += '</tr></thead><tbody>';
    currentEvents.forEach(ev => {
        html += '<tr>';
        html += `<td>${ev.date || ''}</td>`;
        html += `<td>${ev.day || ''}</td>`;
        html += `<td>${ev.skyDE || ''}</td>`;
        html += `<td>${ev.linear || ''}</td>`;
        html += `<td>${ev.eventType || ''}</td>`;
        for (let i = 0; i < 4; ++i) html += '<td class="empty-placeholder"></td>';
        html += `<td>${ev.startTime || ''}</td>`;
        html += `<td>${ev.endTime || ''}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
    copyBtnContainer.classList.remove('hidden');
    timeAdjustGroup.classList.remove('hidden');
}

// Helper: Extract events array from AI response
function extractEvents(text) {
    // Find first {...} JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const obj = JSON.parse(match[0]);
        if (Array.isArray(obj.events)) return obj.events;
    } catch (e) {}
    return null;
}

// OpenAI API call via Vercel proxy
async function generateTable(rawData) {
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: INSTRUCTION_SET,
            userInput: rawData
        })
    });
    if (!response.ok) {
        let err = 'Failed to fetch from server';
        try { err = (await response.json()).error || err; } catch {}
        throw new Error(err);
    }
    const data = await response.json();
    // The OpenAI response is in data.choices[0].message.content
    const text = data.choices?.[0]?.message?.content || '';
    return extractEvents(text);
}

// Event: Generate Table
generateBtn.addEventListener('click', async () => {
    const raw = rawDataInput.value.trim();
    if (!raw) {
        showError('Please paste some raw data.');
        return;
    }
    showLoading();
    try {
        const events = await generateTable(raw);
        if (!events) throw new Error('No events found in AI response.');
        renderTableFromEvents(events);
    } catch (e) {
        showError(e.message || 'Failed to generate table.');
        showPlaceholder();
    }
});

// Event: Clear
clearBtn.addEventListener('click', () => {
    rawDataInput.value = '';
    showPlaceholder();
});

// Event: Copy Table
copyBtn.addEventListener('click', () => {
    const table = tableContainer.querySelector('table');
    if (!table) return;
    // Copy as TSV
    let tsv = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('th,td');
        tsv += Array.from(cells).map(cell => cell.innerText).join('\t') + '\n';
    });
    navigator.clipboard.writeText(tsv.trim()).then(() => {
        copyBtn.classList.add('copy-success');
        copyBtn.innerText = '✔️';
        setTimeout(() => {
            copyBtn.classList.remove('copy-success');
            copyBtn.innerText = '📋';
        }, 1200);
    });
});

// Help Modal
helpModalBtn.addEventListener('click', () => {
    helpModal.classList.remove('modal-hidden');
    helpModal.classList.add('modal-visible');
});
function closeHelp() {
    helpModal.classList.remove('modal-visible');
    helpModal.classList.add('modal-hidden');
}
closeHelpModal.addEventListener('click', closeHelp);
closeHelpModalBtn.addEventListener('click', closeHelp);
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHelp();
});
helpModal.addEventListener('click', e => {
    if (e.target === helpModal) closeHelp();
});

// On load
showPlaceholder(); 
