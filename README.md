# Linen Club Accounting

A desktop application for processing and analyzing purchase order and sales tax reports.

## Features

- Upload and process Purchase Order and Sales Tax Excel reports
- Automatically match related entries between reports
- View detailed results with matched and unmatched items
- Summary statistics of processed data

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the application:
   ```
   npm start
   ```

## Usage

1. Launch the application
2. Upload your Purchase Order Excel report (.xlsx format)
3. Upload your Sales Tax Excel report (.xlsx format)
4. Click the "Process Reports" button
5. View the results in the Results section

## Technical Details

This application is built with:
- Electron.js
- XLSX library for Excel file processing
- Bootstrap for UI

## How it Works

The application:
1. Reads the Excel files from the user's file system
2. Processes the data to extract relevant information from both reports
3. Attempts to match entries between reports based on common identifiers
4. Displays detailed results including:
   - Summary statistics
   - Purchase order data
   - Sales tax data
   - Matched entries
   - Unmatched entries

## Development

### Project Structure

- `/src` - Source code
  - `index.js` - Main Electron process
  - `index.html` - Main application UI
  - `index.css` - Application styling
  - `renderer.js` - Renderer process (UI logic)
  - `preload.js` - Preload script for secure renderer/main process communication

### Building for Production

To build the application for production:

```
npm run make
```

This will create platform-specific distributables in the `/out` directory.
