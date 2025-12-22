/*

This script generates a linear (horizontal) calendar for a specified year, with days flowing left to right and months as rows.

![300](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-Linear-Calendar-Generator.jpg)

## Features
- Horizontal timeline layout with days of the week as columns
- Month names displayed on both left and right sides
- Weekend days (Saturday & Sunday) highlighted
- Day-of-week headers at top and bottom

## Customizable Colors

You can personalize the calendar's appearance by defining your own colors:

1. Create two rectangles in your design.
2. Select both rectangles before running the script:
	• The **fill and stroke colors of the first rectangle** will be applied to weekdays.
	• The **fill and stroke colors of the second rectangle** will be used for weekends.

If no rectangles are selected, the default color schema will be used (white and light blue-gray for weekends).

```javascript
*/

// -------------------------------------
// Constants initiation
// -------------------------------------

const CELL_WIDTH = 176;       // Width of each day cell
const CELL_HEIGHT = 288;      // Height of each day cell
const START_X = 0;            // X start position
const START_Y = 0;            // Y start position
const ROW_SPACING = 32;       // Space between month rows
const MONTH_LABEL_WIDTH = 240; // Space for month labels on sides

// Colors
let COLOR_WEEKEND = "#e8eaed";
let COLOR_WEEKDAY = "#ffffff";
let COLOR_TEXT = "#000000";
let COLOR_WEEKEND_TEXT = "#000000";
let COLOR_HEADER_TEXT = "#000000";
const COLOR_STROKE = "#d0d4db";
let STROKE_WIDTH = 1;
let FILLSTYLE = "solid";
const ROUGHNESS = 0;          // 0 = Architect, 1 = Artist, 2 = Cartoonist
const FONT_FAMILY = 3;        // 1 = Virgil, 2 = Helvetica, 3 = Cascadia (code), 4 = Little One

// Font sizes
const FONT_SIZE_DAY = 56;
const FONT_SIZE_HEADER = 48;
const FONT_SIZE_MONTH = 64;
const FONT_SIZE_YEAR = 112;

// Day constants
const SATURDAY = 6;
const SUNDAY = 0;
const JANUARY = 0;
const FIRST_DAY_OF_THE_MONTH = 1;

// Day names (short)
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Month names (short)
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Number of day columns needed (max 37 to cover all possible month alignments: 6 days offset + 31 days)
const NUM_COLUMNS = 37;

// -------------------------------------

// Ask for requested Year
let requestedYear = parseFloat(new Date().getFullYear());
requestedYear = parseFloat(await utils.inputPrompt("Year?", requestedYear, requestedYear));
if (isNaN(requestedYear)) {
    new Notice("Invalid number");
    return;
}

// -------------------------------------
// Use selected elements for calendar style
// -------------------------------------

let elements = ea.getViewSelectedElements();
if (elements.length >= 1) {
    COLOR_WEEKDAY = elements[0].backgroundColor;
    FILLSTYLE = elements[0].fillStyle;
    STROKE_WIDTH = elements[0].strokeWidth;
}
if (elements.length >= 2) {
    COLOR_WEEKEND = elements[1].backgroundColor;
}

// -------------------------------------
// Helper function to get days in a month
// -------------------------------------

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// -------------------------------------
// Helper function to get the day of week for first day of month
// -------------------------------------

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

// -------------------------------------
// Draw day-of-week headers
// -------------------------------------

function drawDayHeaders(yPosition) {
    ea.style.fontSize = FONT_SIZE_HEADER;
    ea.style.strokeColor = COLOR_TEXT;
    ea.style.fontFamily = FONT_FAMILY;
    
    for (let col = 0; col < NUM_COLUMNS; col++) {
        const dayIndex = col % 7;
        const x = START_X + MONTH_LABEL_WIDTH + (col * CELL_WIDTH);
        
        // Center the text in the cell (approximate width of 2 chars)
        const textX = x + (CELL_WIDTH / 2) - (FONT_SIZE_HEADER * 0.6);
        ea.addText(textX, yPosition, DAY_NAMES[dayIndex]);
    }
}

// -------------------------------------
// Draw month row
// -------------------------------------

function drawMonthRow(year, month, rowIndex) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = getFirstDayOfMonth(year, month);
    const y = START_Y + 160 + (rowIndex * (CELL_HEIGHT + ROW_SPACING));
    
    // Draw month label on the left
    ea.style.fontSize = FONT_SIZE_MONTH;
    ea.style.strokeColor = COLOR_TEXT;
    ea.style.fontFamily = FONT_FAMILY;
    const monthLabelY = y + (CELL_HEIGHT / 2) - (FONT_SIZE_MONTH / 2);
    ea.addText(START_X, monthLabelY, MONTH_NAMES[month]);
    
    // Draw day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const col = firstDayOfWeek + day - 1; // Column position based on day of week alignment
        
        const x = START_X + MONTH_LABEL_WIDTH + (col * CELL_WIDTH);
        const isWeekend = dayOfWeek === SATURDAY || dayOfWeek === SUNDAY;
        
        // Set cell style
        ea.style.backgroundColor = isWeekend ? COLOR_WEEKEND : COLOR_WEEKDAY;
        ea.style.strokeColor = COLOR_STROKE;
        ea.style.strokeWidth = STROKE_WIDTH;
        ea.style.fillStyle = FILLSTYLE;
        ea.style.roughness = ROUGHNESS;
        
        // Draw cell rectangle
        ea.addRect(x, y, CELL_WIDTH, CELL_HEIGHT);
        
        // Draw day number
        ea.style.fontSize = FONT_SIZE_DAY;
        ea.style.strokeColor = COLOR_TEXT;
        ea.style.fontFamily = FONT_FAMILY;
        
        // Position the day number at top center of the cell
        const dayStr = String(day).padStart(2, "0");
        const charWidth = FONT_SIZE_DAY * 0.6; // Approximate character width
        const textWidth = dayStr.length * charWidth;
        const textX = x + (CELL_WIDTH - textWidth) / 2;
        const textY = y + 32; // 32px padding from top
        ea.addText(textX, textY, dayStr);
    }
    
    // Draw month label on the right
    ea.style.fontSize = FONT_SIZE_MONTH;
    ea.style.strokeColor = COLOR_TEXT;
    const rightLabelX = START_X + MONTH_LABEL_WIDTH + (NUM_COLUMNS * CELL_WIDTH) + 60;
    ea.addText(rightLabelX, monthLabelY, MONTH_NAMES[month]);
}

// -------------------------------------
// Main calendar generation
// -------------------------------------

// Draw year title (centered above calendar)
ea.style.fontSize = FONT_SIZE_YEAR;
ea.style.strokeColor = COLOR_TEXT;
ea.style.fontFamily = FONT_FAMILY;
const yearX = START_X + MONTH_LABEL_WIDTH + ((NUM_COLUMNS * CELL_WIDTH) / 2) - 120;
ea.addText(yearX, START_Y - 200, String(requestedYear));

// Draw top day-of-week headers
drawDayHeaders(START_Y);

// Draw all 12 months
for (let month = 0; month < 12; month++) {
    drawMonthRow(requestedYear, month, month);
}

// Draw bottom day-of-week headers
const bottomHeaderY = START_Y + 160 + (12 * (CELL_HEIGHT + ROW_SPACING)) + 40;
drawDayHeaders(bottomHeaderY);

await ea.addElementsToView(false, false, true);
