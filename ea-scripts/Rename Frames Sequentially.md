{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww29200\viewh17260\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
author: Shravya Katapally (https://github.com/shravya-katapally)\
description: When creating presentations using frames with Slideshow Script in Excalidraw, frames need to be numbered (or named) in order manually. Run this script from the Command Palette (or bind a hotkey) to automate that process instead, and will number frames in chronological order. Therefore, draw the frames in the order in which you want the slides to appear.\
---\
\
```js\
/*\
Sequential Frame Renamer for Excalidraw-Obsidian\
*/\
\
if (!ea.targetView) \{\
  new ea.obsidian.Notice("No active Excalidraw view found.");\
  return;\
\}\
\
const allElements = ea.getViewElements();\
const frameElements = allElements.filter(el => el.type === "frame" && !el.isDeleted);\
\
const totalFrames = frameElements.length;\
\
if (totalFrames === 0) \{\
  new ea.obsidian.Notice("No frames found in this drawing.");\
  return;\
\}\
\
// Dynamically determine how many digits we need based on the total count\
const paddingLength = String(totalFrames).length;\
\
ea.copyViewElementsToEAforEditing(frameElements);\
\
frameElements.forEach((frame, index) => \{\
  // Use the dynamic padding length instead of a hardcoded number\
  const sequentialNumber = String(index + 1).padStart(paddingLength, '0');\
  const workbenchFrame = ea.getElement(frame.id);\
  if (workbenchFrame) \{\
    workbenchFrame.name = sequentialNumber;\
  \}\
\});\
\
await ea.addElementsToView();\
new ea.obsidian.Notice(`Successfully renamed $\{totalFrames\} frames sequentially!`);}