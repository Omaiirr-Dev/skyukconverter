// Sky Sports Raw Data → Table Generator
// WARNING: API key is in JS for development only. REMOVE before production!
// const OPENAI_API_KEY = "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";

const OPENAI_API_URL = '/api/openai-proxy';

const INSTRUCTION_SET = `:brain: Sky Sports Raw Data → Structured Table Conversion: Full Instruction Set for AI
:dart: GOAL
To teach an AI how to convert unstructured raw schedule data (from Sky UK listings) into a structured, formatted table with precision, context-awareness, and consistency using standardized conventions and real-world logic.
:inbox_tray: INPUT FORMAT (RAW DATA)
Raw data looks like this:
Thu 22nd May
Football
Livingston 20:00 Ross County
Scottish Premier Play-offs - Final, Sky Sports Football (19:30)
Cricket
England vs Zimbabwe - One-off Test
Men's Test match, Sky Sports Main Event (10:00), Sky Sports Cricket (10:00)
It typically includes:
- Day and date header
- Sport headers (e.g., Football, Cricket, Rugby)
- Event lines: Matchups with times or without
- Descriptions: Competition name + channel(s) + possible alternate time(s)
:outbox_tray: OUTPUT FORMAT (TABLE)
The target is a tabular format like below, with exactly 11 columns:
Date Day Sky UK Linear Event Type Start Time End Time
- Always four empty columns between Event Type and Start Time (used as spacing slots)
- Times are in HH:MM:SS format
- Channels are ignored
- Events retain original order
:jigsaw: STEP-BY-STEP CONVERSION LOGIC
1. Date Parsing
Look for lines like:
Thu 22nd May → becomes
- Date: 22 May 2025 (Assume current year if not given)
- Day: Thu
Keep this value active until a new date appears in the raw data.
2. Event Group Detection
The model should detect headers like:
Football, Cricket, Golf, Tennis, Rugby League, Rugby Union, Netball, Formula 1, etc.
This sets context for how events should be formatted and durations inferred.
3. Event Line Extraction
Examples:
Livingston 20:00 Ross County
England vs Zimbabwe - One-off Test
Tag Heuer Monaco Grand Prix - Race
Premier League Darts Play-Offs - London
Event lines can:
- Contain time (e.g. 13:01)
- Be a full sentence with vs, hyphens, or naming conventions
4. Supporting Info / Time Source
Often on the next line, there's detail with a channel and alternate time:
Scottish Premier Play-offs - Final, Sky Sports Football (19:30)
This may give:
- Start time (if match line didn't)
- Better time to use (apply earliest time rule)
- Tour or competition name (for use in naming convention)
:clock4: TIME LOGIC & ROUNDING RULES
A. Use the earliest of all listed times.
Example:
Match listed at 13:01, description gives 12:00 → use 12:00
If 14:50 and 15:00 are listed → use 14:50
If 14:59 and 15:01 → round to 15:00
B. Event Durations (Estimate)
Sport Event Type Duration
Football All matches 2 hours
Cricket T20 3 hours
Cricket ODI 5 hours
Cricket Test / One-off Test 8 hours
Rugby Any 2 hours
Tennis Multi-event blocks 4.5 hours
Golf Any 5 hours
Formula 1 Race 2 hours
Formula 1 Practice/Quali 1 hour
Darts Premier League 3 hours
Netball Match 2 hours
:receipt: EVENT NAME FORMATTING RULES
:tennis: Tennis
Merge multiple tours into one line:
Tennis: ATP Tour 500 Hamburg, ATP Tour 250 Geneva, WTA Tour 500 Strasbourg, WTA 250 Rabat
:cricket_bat_and_ball: Cricket
Use "Cricket: [Team A] v [Team B]"
If the format is crucial (like Test, T20, ODI), add in brackets:
Cricket: England v Zimbabwe (One-off Test)
Cricket: England v West Indies (ODI)
:rugby_ball: Rugby
Label by sport:
Rugby: Huddersfield Giants v Leigh Leopards
Rugby: Queensland v New South Wales
:football2: Football
Simple match phrasing:
Football: Livingston v Ross County
:golf: Golf
Use the format:
Golf: [Tour]: [Event Name]
Examples:
Golf: DP World Tour: Soudal Open
Golf: LPGA Tour: U.S. Women's Open
Golf: PGA Tour: The Memorial Tournament
:racing_car: Formula Racing
Split Formula 1 and Formula 2 into separate events, each with colon:
Formula 1: Aramco Spanish Grand Prix - Race
Formula 2: Spanish Grand Prix - Feature Race
:checkered_flag: IndyCar and Other Motorsports
Always include colon after sport type:
IndyCar: Indianapolis 500
NASCAR: Coca-Cola 600
MotoGP: Italian Grand Prix
:no_entry_symbol: EXCLUSION RULES
- COMPLETELY REMOVE any events labeled as "Other Sports" - do not include them in output
- Do not use "Other Sports:" as a category - split into specific sport types with colons
:drawing_pin: KEY RULES SUMMARY
- Keep original data order — never reorder chronologically.
- Omit channel names completely.
- Use earliest time listed, round 1–2 minute differences.
- Apply naming formats strictly (e.g., "Golf: PGA Tour: Event").
- Insert 4 blank columns between Event Type and Start Time.
- Output must match the fixed column format.
- CRUCIAL: Only use the USER INPUT section for generating the table. Do not use any example data or previous examples. 
- ONLY GENERATE SOMETHING IF YOU HAVE THE RAW DATA AND USE THAT WITH YOUR FORMATTING TO MAKE THE TABLE
- Please dont make a table will random data or completely irrlevant data, minor changes are still to be undestood and converted
Return JSON with events array. Each event should have:
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
...
CRITICAL: Return ONLY valid JSON, no other text. Follow these formatting, logic, and display rules with complete consistency.

If the input does not look like valid Sky Sports schedule data (e.g., it does not contain sports, dates, or event listings), return an empty events array: {"events": []}
 }
 ]
}
CRITICAL: Return ONLY valid JSON, no other text. Follow these formatting, logic, and display rules with complete consistency.`;

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
