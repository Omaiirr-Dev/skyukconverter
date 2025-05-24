// Sky Sports Raw Data → Table Generator
// WARNING: API key removed. Now using proxy endpoint.
const INSTRUCTION_SET = `🧠 Sky Sports Raw Data → Structured Table Conversion: Full Instruction Set for AI
🎯 GOAL
To teach an AI how to convert unstructured raw schedule data (from Sky UK listings) into a structured, formatted table with precision, context-awareness, and consistency using standardized conventions and real-world logic.

📥 INPUT FORMAT (RAW DATA)
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

📤 OUTPUT FORMAT (TABLE)
The target is a tabular format like below, with exactly 11 columns:

Date\tDay\tSky UK\tLinear\tEvent Type\t\t\t\t\tStart Time\tEnd Time

Always four empty columns between Event Type and Start Time (used as spacing slots)
Times are in HH:MM:SS format
Channels are ignored
Events retain original order

🧩 STEP-BY-STEP CONVERSION LOGIC
1. Date Parsing: Look for lines like 'Thu 22nd May' → Date: 22 May 2025 (assume current year if not given), Day: Thu. Keep this value active until a new date appears.
2. Event Group Detection: Detect headers like Football, Cricket, Golf, Tennis, Rugby League, Rugby Union, Netball, Formula 1, etc. This sets context for formatting and duration.
3. Event Line Extraction: Event lines can contain time, be a full sentence with vs, hyphens, or naming conventions.
4. Supporting Info / Time Source: Often on the next line, there's detail with a channel and alternate time. Use the earliest of all listed times.

🕓 TIME LOGIC & ROUNDING RULES
A. Use the earliest of all listed times. If 14:50 and 15:00 are listed → use 14:50. If 14:59 and 15:01 → round to 15:00.
B. Event Durations (Estimate):
- Football: 2 hours
- Cricket T20: 3 hours
- Cricket ODI: 5 hours
- Cricket Test/One-off Test: 8 hours
- Rugby: 2 hours
- Tennis (multi-event): 4.5 hours
- Golf: 5 hours
- Formula 1 Race: 2 hours
- Formula 1 Practice/Quali: 1 hour
- Darts Premier League: 3 hours
- Netball: 2 hours

🧾 EVENT NAME FORMATTING RULES
- Tennis: Merge multiple tours into one line: Tennis: ATP Tour 500 Hamburg, ATP Tour 250 Geneva, WTA Tour 500 Strasbourg, WTA 250 Rabat
- Cricket: Use "Cricket: [Team A] v [Team B]". If format is crucial (Test, T20, ODI), add in brackets: Cricket: England v Zimbabwe (One-off Test)
- Rugby: Rugby: Huddersfield Giants v Leigh Leopards
- Football: Football: Livingston v Ross County
- Golf: Golf: [Tour]: [Event Name]. The [Tour] must be the official tour name (e.g., PGA Tour, USA Tour, LPGA Tour, DP World Tour, European Tour, etc). Example: Golf: PGA Tour: The Memorial Tournament, Golf: USA Tour: Charles Schwab Championship, Golf: LPGA Tour: U.S. Women's Open, Golf: DP World Tour: Soudal Open
- Formula 1: Formula 1: Aramco Spanish Grand Prix - Race

🧪 EXAMPLE DATA CONVERSION
Raw:
Thu 22nd May  
Football  
Livingston 20:00 Ross County  
Scottish Premier Play-offs - Final, Sky Sports Football (19:30)

Cricket  
England vs Zimbabwe - One-off Test  
Men's Test match, Sky Sports Main Event (10:00), Sky Sports Cricket (10:00)

Table Output:
Date\tDay\tSky UK\tLinear\tEvent Type\t\t\t\t\tStart Time\tEnd Time
22 May 2025\tThu\tSky UK\tLinear\tFootball: Livingston v Ross County\t\t\t\t\t19:30:00\t21:30:00
22 May 2025\tThu\tSky UK\tLinear\tCricket: England v Zimbabwe (One-off Test)\t\t\t\t\t10:00:00\t18:00:00

📌 KEY RULES SUMMARY
- Keep original data order — never reorder chronologically.
- Omit channel names completely.
- Use earliest time listed, round 1–2 minute differences.
- Apply naming formats strictly (e.g., "Golf: PGA Tour: Event").
- Insert 4 blank columns between Event Type and Start Time.
- Output must match the fixed column format.

✅ FINAL NOTE
Your AI must follow these formatting, logic, and display rules with complete consistency. Test against varied data (multi-time events, missing times, unusual phrasing) to validate accuracy.

🔧 SECTION-SPECIFIC EXCEPTION: "Other Sports"
If a raw data section is labeled "Other Sports", do not use this label in the output. Instead, extract the event type directly from the listed event names, e.g.:
Formula 3 → becomes Formula 3
Formula 2 → becomes Formula 2
Indycar: Streets of Detroit → becomes Indycar: Streets of Detroit

---
OUTPUT FORMAT (JSON)

Return ONLY valid JSON in the following format:

{
  "events": [
    {
      "date": "22 May 2025",
      "day": "Thu",
      "skyDE": "Sky UK",
      "linear": "Linear",
      "eventType": "Football: Livingston v Ross County",
      "startTime": "19:30:00",
      "endTime": "21:30:00"
    }
    // ... more events
  ]
}

Do not include any commentary, table formatting, or extra text. Only return the JSON object as shown above.
`;

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
    // Remove Markdown code block markers if present
    const cleaned = text.replace(/```json|```/g, '').trim();
    // Find first {...} JSON block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const obj = JSON.parse(match[0]);
        if (Array.isArray(obj.events)) return obj.events;
    } catch (e) {}
    return null;
}

// OpenAI API call
async function generateTable(rawData) {
    const prompt = `${INSTRUCTION_SET}\n\nRAW DATA:\n${rawData}\n`;
    const body = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "You are a helpful assistant that strictly follows formatting and logic rules for table conversion." },
            { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1800
    };
    const res = await fetch("/api/openai", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Proxy API error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log("AI raw response:", text); // Debug log
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
        if (!events) throw new Error('No events found in AI response. Please try again, or check your input.');
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