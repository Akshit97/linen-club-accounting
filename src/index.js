const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const XLSX = require('xlsx');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false // Don't show until ready
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Maximize window on creation
  mainWindow.maximize();
  
  // Show window when ready to avoid visual flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // Set up IPC handlers for Excel processing
  setupExcelProcessing();
  // Set up file dialog handler
  setupFileDialogHandler();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit();
});

// Setup file dialog handler
function setupFileDialogHandler() {
  // Handler for selecting multiple purchase order files
  ipcMain.handle('dialog:openMultipleFiles', async (event, title) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title || 'Select Files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return [];
    }
    
    return filePaths;
  });

  // Existing handler for single file selection
  ipcMain.handle('dialog:openFile', async (event, title) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: title || 'Select File',
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return null;
    }
    
    return filePaths[0];
  });
}

// Setup IPC handlers for Excel processing
function setupExcelProcessing() {
  // New handler for processing multiple purchase order files
  ipcMain.handle('process-excel-files-multi', async (event, purchaseOrderFilePaths, salesTaxFilePath) => {
    try {
      console.log('Processing files:', purchaseOrderFilePaths, salesTaxFilePath);
      
      if (!purchaseOrderFilePaths || purchaseOrderFilePaths.length === 0 || !salesTaxFilePath) {
        throw new Error('File paths are required');
      }
      
      // Array to store combined purchase order data
      let combinedPurchaseOrderData = [];
      
      // Process each purchase order file
      for (const purchaseOrderFilePath of purchaseOrderFilePaths) {
        console.log(`Processing purchase order file: ${purchaseOrderFilePath}`);
        
        // Read and process purchase order data
        const poWorkbook = XLSX.readFile(purchaseOrderFilePath);
        const poWorksheet = poWorkbook.Sheets[poWorkbook.SheetNames[0]];
        
        // Convert to CSV string first
        const purchaseOrderCSV = XLSX.utils.sheet_to_csv(poWorksheet);
        // Parse CSV string to array of objects
        const purchaseOrderData = parseCSV(purchaseOrderCSV);
        
        // Add to combined data
        combinedPurchaseOrderData = [...combinedPurchaseOrderData, ...purchaseOrderData];
      }
      
      console.log(`Combined purchase order data count: ${combinedPurchaseOrderData.length}`);
      
      // Read and process sales tax data
      const stWorkbook = XLSX.readFile(salesTaxFilePath);
      const stWorksheet = stWorkbook.Sheets[stWorkbook.SheetNames[0]];
      
      // Convert to CSV string first
      const salesTaxCSV = XLSX.utils.sheet_to_csv(stWorksheet);
      // Parse CSV string to array of objects
      const salesTaxData = parseCSV(salesTaxCSV);
      
      // Process and match the data
      const result = processData(combinedPurchaseOrderData, salesTaxData);
      
      // Generate CSV outputs
      const purchaseOrderOutputCSV = convertToCSV(result.purchaseOrderData);
      const salesTaxOutputCSV = convertToCSV(result.salesTaxData);
      const matchedDataCSV = convertToCSV(result.matchedData);
      const salesWithoutPurchaseCSV = convertToCSV(result.salesWithoutPurchase);
      const unusedPurchasesCSV = convertToCSV(result.unusedPurchases);
      const supplierGroupedDataCSV = convertToCSV(result.supplierGroupedData);
      const invoiceGroupedDataCSV = convertToCSV(result.invoiceGroupedData);
      
      // Use the directory of the first purchase order file for output
      const outputDir = path.dirname(purchaseOrderFilePaths[0]);
      const purchaseOrderOutputPath = path.join(outputDir, 'updated_purchase_order_data.csv');
      fs.writeFileSync(purchaseOrderOutputPath, purchaseOrderOutputCSV);
      
      // Write the sales tax data to a CSV file
      const salesTaxOutputPath = path.join(outputDir, 'updated_sales_tax_data.csv');
      fs.writeFileSync(salesTaxOutputPath, salesTaxOutputCSV);
      
      // Write the matched data to a CSV file
      const matchedDataOutputPath = path.join(outputDir, 'matched_data.csv');
      fs.writeFileSync(matchedDataOutputPath, matchedDataCSV);
      
      // Write the sales without purchase data to a CSV file
      const salesWithoutPurchaseOutputPath = path.join(outputDir, 'sales_without_purchase.csv');
      fs.writeFileSync(salesWithoutPurchaseOutputPath, salesWithoutPurchaseCSV);
      
      // Write the unused purchases data to a CSV file
      const unusedPurchasesOutputPath = path.join(outputDir, 'unused_purchases.csv');
      fs.writeFileSync(unusedPurchasesOutputPath, unusedPurchasesCSV);
      
      // Write the supplier grouped data to a CSV file
      const supplierGroupedDataOutputPath = path.join(outputDir, 'supplier_grouped_data.csv');
      fs.writeFileSync(supplierGroupedDataOutputPath, supplierGroupedDataCSV);
      
      // Write the invoice grouped data to a CSV file
      const invoiceGroupedDataOutputPath = path.join(outputDir, 'invoice_grouped_data.csv');
      fs.writeFileSync(invoiceGroupedDataOutputPath, invoiceGroupedDataCSV);
      
      // Write the summary to a text file
      const summaryOutputPath = path.join(outputDir, 'summary.txt');
      fs.writeFileSync(summaryOutputPath, result.summaryText);
      
      return {
        success: true,
        purchaseOrderData: result.purchaseOrderData.slice(0, 50), // Limit results for performance
        salesTaxData: result.salesTaxData.slice(0, 50), // Limit results for performance
        matchedData: result.matchedData,
        salesWithoutPurchase: result.salesWithoutPurchase,
        unusedPurchases: result.unusedPurchases,
        supplierGroupedData: result.supplierGroupedData,
        invoiceGroupedData: result.invoiceGroupedData,
        garmentSalesDateArray: result.garmentSalesDateArray,
        fabricSalesDateArray: result.fabricSalesDateArray,
        summary: result.summary,
        summaryText: result.summaryText,
        // Add CSV strings
        purchaseOrderCSV: purchaseOrderOutputCSV,
        salesTaxCSV: salesTaxOutputCSV,
        matchedDataCSV: matchedDataCSV,
        salesWithoutPurchaseCSV: salesWithoutPurchaseCSV,
        unusedPurchasesCSV: unusedPurchasesCSV,
        supplierGroupedDataCSV: supplierGroupedDataCSV,
        invoiceGroupedDataCSV: invoiceGroupedDataCSV,
        // Add output file paths
        outputFiles: {
          purchaseOrderOutputPath,
          salesTaxOutputPath,
          matchedDataOutputPath,
          salesWithoutPurchaseOutputPath,
          unusedPurchasesOutputPath,
          supplierGroupedDataOutputPath,
          invoiceGroupedDataOutputPath,
          summaryOutputPath
        }
      };
    } catch (error) {
      console.error('Error processing Excel files:', error);
      return {
        success: false,
        message: `Error processing files: ${error.message}`
      };
    }
  });
  
  // Keep the existing handler for single purchase order file processing
  ipcMain.handle('process-excel-files', async (event, purchaseOrderFilePath, salesTaxFilePath) => {
    try {
      console.log('Processing files:', purchaseOrderFilePath, salesTaxFilePath);
      
      if (!purchaseOrderFilePath || !salesTaxFilePath) {
        throw new Error('File paths are required');
      }
      
      // Read and process purchase order data
      const poWorkbook = XLSX.readFile(purchaseOrderFilePath);
      const poWorksheet = poWorkbook.Sheets[poWorkbook.SheetNames[0]];
      
      // Convert to CSV string first
      const purchaseOrderCSV = XLSX.utils.sheet_to_csv(poWorksheet);
      // Parse CSV string to array of objects
      const purchaseOrderData = parseCSV(purchaseOrderCSV);
      
      // Read and process sales tax data
      const stWorkbook = XLSX.readFile(salesTaxFilePath);
      const stWorksheet = stWorkbook.Sheets[stWorkbook.SheetNames[0]];
      
      // Convert to CSV string first
      const salesTaxCSV = XLSX.utils.sheet_to_csv(stWorksheet);
      // Parse CSV string to array of objects
      const salesTaxData = parseCSV(salesTaxCSV);
      
      // Process and match the data
      const result = processData(purchaseOrderData, salesTaxData);
      
      // Generate CSV outputs
      const purchaseOrderOutputCSV = convertToCSV(result.purchaseOrderData);
      const salesTaxOutputCSV = convertToCSV(result.salesTaxData);
      const matchedDataCSV = convertToCSV(result.matchedData);
      const salesWithoutPurchaseCSV = convertToCSV(result.salesWithoutPurchase);
      const unusedPurchasesCSV = convertToCSV(result.unusedPurchases);
      const supplierGroupedDataCSV = convertToCSV(result.supplierGroupedData);
      const invoiceGroupedDataCSV = convertToCSV(result.invoiceGroupedData);
      
      // Write the updated purchase order data to a CSV file
      const outputDir = path.dirname(purchaseOrderFilePath);
      const purchaseOrderOutputPath = path.join(outputDir, 'updated_purchase_order_data.csv');
      fs.writeFileSync(purchaseOrderOutputPath, purchaseOrderOutputCSV);
      
      // Write the sales tax data to a CSV file
      const salesTaxOutputPath = path.join(outputDir, 'updated_sales_tax_data.csv');
      fs.writeFileSync(salesTaxOutputPath, salesTaxOutputCSV);
      
      // Write the matched data to a CSV file
      const matchedDataOutputPath = path.join(outputDir, 'matched_data.csv');
      fs.writeFileSync(matchedDataOutputPath, matchedDataCSV);
      
      // Write the sales without purchase data to a CSV file
      const salesWithoutPurchaseOutputPath = path.join(outputDir, 'sales_without_purchase.csv');
      fs.writeFileSync(salesWithoutPurchaseOutputPath, salesWithoutPurchaseCSV);
      
      // Write the unused purchases data to a CSV file
      const unusedPurchasesOutputPath = path.join(outputDir, 'unused_purchases.csv');
      fs.writeFileSync(unusedPurchasesOutputPath, unusedPurchasesCSV);
      
      // Write the supplier grouped data to a CSV file
      const supplierGroupedDataOutputPath = path.join(outputDir, 'supplier_grouped_data.csv');
      fs.writeFileSync(supplierGroupedDataOutputPath, supplierGroupedDataCSV);
      
      // Write the invoice grouped data to a CSV file
      const invoiceGroupedDataOutputPath = path.join(outputDir, 'invoice_grouped_data.csv');
      fs.writeFileSync(invoiceGroupedDataOutputPath, invoiceGroupedDataCSV);
      
      // Write the summary to a text file
      const summaryOutputPath = path.join(outputDir, 'summary.txt');
      fs.writeFileSync(summaryOutputPath, result.summaryText);
      
      return {
        success: true,
        purchaseOrderData: result.purchaseOrderData.slice(0, 50), // Limit results for performance
        salesTaxData: result.salesTaxData.slice(0, 50), // Limit results for performance
        matchedData: result.matchedData,
        salesWithoutPurchase: result.salesWithoutPurchase,
        unusedPurchases: result.unusedPurchases,
        supplierGroupedData: result.supplierGroupedData,
        invoiceGroupedData: result.invoiceGroupedData,
        garmentSalesDateArray: result.garmentSalesDateArray,
        fabricSalesDateArray: result.fabricSalesDateArray,
        summary: result.summary,
        summaryText: result.summaryText,
        // Add CSV strings
        purchaseOrderCSV: purchaseOrderOutputCSV,
        salesTaxCSV: salesTaxOutputCSV,
        matchedDataCSV: matchedDataCSV,
        salesWithoutPurchaseCSV: salesWithoutPurchaseCSV,
        unusedPurchasesCSV: unusedPurchasesCSV,
        supplierGroupedDataCSV: supplierGroupedDataCSV,
        invoiceGroupedDataCSV: invoiceGroupedDataCSV,
        // Add output file paths
        outputFiles: {
          purchaseOrderOutputPath,
          salesTaxOutputPath,
          matchedDataOutputPath,
          salesWithoutPurchaseOutputPath,
          unusedPurchasesOutputPath,
          supplierGroupedDataOutputPath,
          invoiceGroupedDataOutputPath,
          summaryOutputPath
        }
      };
    } catch (error) {
      console.error('Error processing Excel files:', error);
      return {
        success: false,
        message: `Error processing files: ${error.message}`
      };
    }
  });
  
  // Add a new handler to save any data as CSV
  ipcMain.handle('save-data-as-csv', async (event, data, defaultPath) => {
    try {
      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save CSV File',
        defaultPath: defaultPath || 'data.csv',
        filters: [
          { name: 'CSV Files', extensions: ['csv'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { success: false, message: 'Operation cancelled' };
      }
      
      // Convert data to CSV
      let csvContent;
      if (typeof data === 'string') {
        // Already CSV string
        csvContent = data;
      } else if (Array.isArray(data)) {
        // Array of objects
        csvContent = convertToCSV(data);
      } else {
        throw new Error('Invalid data format');
      }
      
      // Write to file
      fs.writeFileSync(filePath, csvContent);
      
      return {
        success: true,
        filePath
      };
    } catch (error) {
      console.error('Error saving CSV file:', error);
      return {
        success: false,
        message: `Error saving file: ${error.message}`
      };
    }
  });
}

// Helper function to parse CSV string to array of objects
function parseCSV(csvString) {
  // Split by line
  const lines = csvString.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  // Find the actual header row by looking for known column names
  let headerRowIndex = 0;
  const purchaseOrderKeywords = ['Store Code', 'Invoice Number', 'Suppiler Name', 'Item Id', 'Material Code'];
  const salesTaxKeywords = ['Store Code', 'Receipt Id', 'Item Id', 'Material Code', 'Bar Code'];
  const allKeywords = [...new Set([...purchaseOrderKeywords, ...salesTaxKeywords])];
  
  // Find the row that contains the most expected header keywords
  let maxKeywordCount = 0;
  for (let i = 0; i < Math.min(20, lines.length); i++) { // Check first 20 rows to be safe
    const keywordCount = allKeywords.filter(keyword => lines[i].includes(keyword)).length;
    if (keywordCount > maxKeywordCount) {
      maxKeywordCount = keywordCount;
      headerRowIndex = i;
    }
  }
  
  console.log(`Detected header row at index ${headerRowIndex}`);
  
  // Extract headers from identified header row
  const headers = lines[headerRowIndex].split(',').map(header => header.trim());
  
  // Parse data rows (starting after header row)
  const results = [];
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    // Handle CSV properly - quoted fields might contain commas
    const values = parseCSVLine(lines[i]);
    
    // Skip rows that don't have enough columns - likely not data rows
    if (values.length < headers.length / 2) continue;
    
    // Check if this is an empty record (all values are empty or whitespace)
    const isEmpty = values.every(val => !val || val.trim() === '');
    if (isEmpty) continue;
    
    const row = {};
    
    // Map values to headers
    headers.forEach((header, index) => {
      if (header) { // Only add if header exists
        row[header] = index < values.length ? values[index].trim() : '';
      }
    });
    
    // Check if the record has any meaningful data
    // Skip records where all or almost all fields are empty
    const nonEmptyFieldCount = Object.values(row).filter(val => val && val.trim() !== '').length;
    if (nonEmptyFieldCount <= 1) continue; // Skip if only one or zero fields have data
    
    results.push(row);
  }
  
  console.log(`Parsed ${results.length} data rows`);
  return results;
}

// Parse a single CSV line correctly handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // If we see a quote when already in quotes, and the next char is also a quote, it's an escaped quote
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quotes state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  return result;
}

// Helper function to convert array of objects to CSV string
function convertToCSV(objArray) {
  if (!objArray || objArray.length === 0) return '';
  
  // Extract headers from first object
  const headers = Object.keys(objArray[0]);
  
  // Create header row
  const csvRows = [headers.join(',')];
  
  // Add data rows
  objArray.forEach(obj => {
    const values = headers.map(header => {
      const value = obj[header] ?? '';
      // Escape commas, quotes, etc. in values
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

// For DD-MM-YYYY format

function parseDate(dateStr) {
  const parts = dateStr.split('-');
  // Instead of using Date object which can have timezone issues,
  // directly format the string in YYYY-MM-DD format
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// Helper function to parse a string to a number, handling currency symbols and other non-numeric characters
function parseNumberValue(value) {
  if (value === undefined || value === null || value === '') return 0;
  
  // If it's already a number, return it
  if (typeof value === 'number') return value;
  
  // Convert to string if it's not already
  const strValue = String(value);
  
  // Remove currency symbols, commas, and other non-numeric characters
  // Keep decimal points, minus signs for negative numbers
  const cleaned = strValue.replace(/[^0-9.-]/g, '');
  
  // Parse the cleaned string to a float
  const result = parseFloat(cleaned);
  
  // Return 0 if the result is NaN
  return isNaN(result) ? 0 : result;
}

// Process and match data between purchase order and sales tax reports
function processData(purchaseOrderData, salesTaxData) {
  // Validate input data
  if (!Array.isArray(purchaseOrderData) || !Array.isArray(salesTaxData)) {
    throw new Error('Invalid data format');
  }
  
  if (purchaseOrderData.length === 0 || salesTaxData.length === 0) {
    throw new Error('Empty data provided');
  }
  
  // Filter out records that are essentially empty
  purchaseOrderData = purchaseOrderData.filter(item => {
    // Check if item has an Item Id - crucial for matching
    if (!item['Item Id']) return false;
    
    // Count non-empty fields
    const nonEmptyFieldCount = Object.values(item)
      .filter(val => val !== undefined && val !== null && val !== '')
      .length;
      
    // Keep records with sufficient data
    return nonEmptyFieldCount > 3; // Require at least a few meaningful fields
  });
  
  // Similarly filter sales tax data
  salesTaxData = salesTaxData.filter(item => {
    // Check if item has an Item Id - crucial for matching
    if (!item['Item Id']) return false;
    
    // Count non-empty fields
    const nonEmptyFieldCount = Object.values(item)
      .filter(val => val !== undefined && val !== null && val !== '')
      .length;
      
    // Keep records with sufficient data
    return nonEmptyFieldCount > 3; // Require at least a few meaningful fields
  });
  
  console.log('Filtered Purchase Order Data Count:', purchaseOrderData.length);
  console.log('Filtered Sales Tax Data Count:', salesTaxData.length);
  
  if (purchaseOrderData.length === 0 || salesTaxData.length === 0) {
    throw new Error('No valid data records after filtering empty entries');
  }
  
  console.log('Purchase Order Data Sample:', purchaseOrderData[0]);
  console.log('Sales Tax Data Sample:', salesTaxData[0]);
  
  // Add Unit Purchase Amount to purchase order data
  purchaseOrderData = purchaseOrderData.map(item => {
    const unitCost = parseNumberValue(item['Unit Cost']);
    const igstRate = parseNumberValue(item['IGST Rate']);
    const unitPurchaseAmount = unitCost + (unitCost * igstRate / 100);
    
    return {
      ...item,
      'Unit Purchase Amount': unitPurchaseAmount
    };
  });
  
  console.log('Updated Purchase Order Data Sample:', purchaseOrderData[0]);
  
  // Create a map of purchase order items indexed by Item Id for quick lookup
  const purchaseOrderMap = new Map();
  purchaseOrderData.forEach(poItem => {
    if (poItem['Item Id']) {
      purchaseOrderMap.set(poItem['Item Id'].toString(), poItem);
    }
  });
  
  // Add required fields to sales tax data by looking up purchase order data
  const salesTaxWithPurchaseData = [];
  const salesWithoutPurchase = [];
  
  salesTaxData.forEach(stItem => {
    const itemId = stItem['Item Id']?.toString();
    const poItem = itemId ? purchaseOrderMap.get(itemId) : null;
    
    const quantity = parseNumberValue(stItem['Qty']);
    const netAmount = parseNumberValue(stItem['Net Amount']);
    const cgstAmount = parseNumberValue(stItem['CGST Tax Amount']);
    const sgstAmount = parseNumberValue(stItem['SGST Tax Amount']);
    
    const unitPurchaseAmount = poItem ? parseNumberValue(poItem['Unit Purchase Amount']) : 0;
    const totalPurchaseAmount = unitPurchaseAmount * quantity;
    const totalSaleAmount = netAmount + cgstAmount + sgstAmount;
    
    // Strip dollar signs from all string values
    const cleanedItem = {};
    for (const [key, value] of Object.entries(stItem)) {
      if (typeof value === 'string' && value.includes('$')) {
        cleanedItem[key] = value.replace(/\$/g, '');
      } else {
        cleanedItem[key] = value;
      }
    }
    
    const enrichedItem = {
      ...cleanedItem,
      'Suppiler Name': poItem ? poItem['Suppiler Name'] : '',
      'Unit Purchase Amount': unitPurchaseAmount,
      'Total Purchase Amount': totalPurchaseAmount,
      'Total Sale Amount': totalSaleAmount,
      'Has Matching Purchase': !!poItem
    };
    
    salesTaxWithPurchaseData.push(enrichedItem);
    
    // Track items without a matching purchase
    if (!poItem) {
      salesWithoutPurchase.push(enrichedItem);
    }
  });
  
  // Update the sales tax data with the enriched data
  salesTaxData = salesTaxWithPurchaseData;
  
  console.log('Updated Sales Tax Data Sample:', salesTaxData[0]);
  
  // Find unused purchase orders (no matching sales)
  const unusedPurchases = purchaseOrderData.filter(poItem => {
    if (!poItem['Item Id']) return true;
    return !salesTaxData.some(stItem => 
      stItem['Item Id']?.toString() === poItem['Item Id'].toString() && stItem['Has Matching Purchase']
    );
  });
  
  // Calculate totals
  let totalPurchaseAmount = 0;  // Gross purchase amount
  let totalSaleAmount = 0;      // Gross sale amount
  let totalCGSTAmount = 0;
  let totalSGSTAmount = 0;
  let totalNetSaleAmount = 0;    // Net sale amount (without tax)
  let totalNetPurchaseAmount = 0; // Net purchase amount (without tax)
  let totalNetProfit = 0;       // Net profit (Net Sale - Net Purchase)
  
  // Track GST by rate
  const gstByRate = new Map(); // Map to track GST amounts by rate
  
  salesTaxData.forEach(item => {
    const quantity = parseNumberValue(item['Qty']);
    const netSaleAmount = parseNumberValue(item['Net Amount']);
    
    // Calculate the unit cost without tax (net purchase per unit)
    const unitGrossPurchaseAmount = parseNumberValue(item['Unit Purchase Amount']);
    // Assuming the tax rate is the same as in the sales data (IGST for purchase = CGST + SGST for sales)
    const cgstRate = parseNumberValue(item['CGST Rate']);
    const sgstRate = parseNumberValue(item['SGST Rate']);
    const totalTaxRate = cgstRate + sgstRate;
    
    // Track GST by rate
    const cgstAmount = parseNumberValue(item['CGST Tax Amount']);
    const sgstAmount = parseNumberValue(item['SGST Tax Amount']);
    const totalGstAmount = cgstAmount + sgstAmount;
    
    // Calculate purchase GST
    const unitNetPurchaseAmount = unitGrossPurchaseAmount / (1 + (totalTaxRate / 100));
    const netPurchaseAmount = unitNetPurchaseAmount * quantity;
    const purchaseGstAmount = (unitGrossPurchaseAmount * quantity) - netPurchaseAmount;
    const purchaseCgstAmount = purchaseGstAmount / 2; // Assuming equal split between CGST and SGST
    const purchaseSgstAmount = purchaseGstAmount / 2;
    
    // Create or update entry in gstByRate map
    if (totalTaxRate > 0) {
      const rateKey = `${totalTaxRate.toFixed(2)}%`;
      if (!gstByRate.has(rateKey)) {
        gstByRate.set(rateKey, {
          rate: totalTaxRate,
          cgstAmount: 0,
          sgstAmount: 0,
          totalAmount: 0,
          purchaseCgstAmount: 0,
          purchaseSgstAmount: 0,
          purchaseGstAmount: 0,
          netGstAmount: 0, // Sale GST - Purchase GST
          items: 0
        });
      }
      
      const rateEntry = gstByRate.get(rateKey);
      rateEntry.cgstAmount += cgstAmount;
      rateEntry.sgstAmount += sgstAmount;
      rateEntry.totalAmount += totalGstAmount;
      rateEntry.purchaseCgstAmount += purchaseCgstAmount;
      rateEntry.purchaseSgstAmount += purchaseSgstAmount;
      rateEntry.purchaseGstAmount += purchaseGstAmount;
      rateEntry.netGstAmount += (totalGstAmount - purchaseGstAmount);
      rateEntry.items++;
    }
    
    // Calculate total amounts
    const grossPurchaseAmount = unitGrossPurchaseAmount * quantity;
    totalPurchaseAmount += grossPurchaseAmount;
    totalSaleAmount += parseNumberValue(item['Total Sale Amount']);
    totalCGSTAmount += cgstAmount;
    totalSGSTAmount += sgstAmount;
    totalNetSaleAmount += netSaleAmount;
    totalNetPurchaseAmount += netPurchaseAmount;
    
    // Calculate net profit as net sale amount - net purchase amount
    const itemNetProfit = netSaleAmount - netPurchaseAmount;
    totalNetProfit += itemNetProfit;
  });
  
  // Convert gstByRate map to array for easier processing in the UI
  const gstBreakdownByRate = Array.from(gstByRate.values())
    .sort((a, b) => b.rate - a.rate) // Sort by rate in descending order
    .map(entry => ({
      rate: entry.rate.toFixed(2) + '%',
      cgstAmount: entry.cgstAmount,
      sgstAmount: entry.sgstAmount,
      totalAmount: entry.totalAmount,
      purchaseCgstAmount: entry.purchaseCgstAmount,
      purchaseSgstAmount: entry.purchaseSgstAmount,
      purchaseGstAmount: entry.purchaseGstAmount,
      netGstAmount: entry.netGstAmount,
      items: entry.items
    }));
  
  // Match records between sales tax and purchase orders based on Item Id (prioritizing sales)
  // In this approach, we start from sales data and look for matching purchases
  const matchedData = [];
  
  salesTaxData.forEach(stItem => {
    if (stItem['Item Id']) {
      const poItem = purchaseOrderMap.get(stItem['Item Id'].toString());
      
      if (poItem) {
        // Create a merged record with purchase data
        matchedData.push({
          // Include all sales tax data
          ...stItem,
          // Add prefix to purchase order fields to differentiate
          ...prefixKeys(poItem, 'PO_', ['Item Id'])
        });
      }
    }
  });
  
  // Group purchase orders by invoice number for summary
  const invoiceGroupedData = groupPurchaseOrdersByInvoice(purchaseOrderData);
  
  // Calculate garment-specific quantities
  let garmentPurchaseQuantity = 0;
  let garmentSaleQuantity = 0;
  
  // Calculate fabric-specific quantities
  let fabricPurchaseQuantity = 0;
  let fabricSaleQuantity = 0;
  
  // Map to track garment sales by date
  const garmentSalesByDate = new Map();
  
  // Map to track fabric sales by date
  const fabricSalesByDate = new Map();
  
  // Track items from garment suppliers
  const garmentSupplierItems = new Set();
  
  // Track items from fabric suppliers
  const fabricSupplierItems = new Set();
  
  // Check purchase order data for garment and fabric suppliers
  purchaseOrderData.forEach(item => {
    const supplierName = (item['Suppiler Name'] || '').toLowerCase();
    const itemId = item['Item Id']?.toString();
    
    if (supplierName.includes('garment') && itemId) {
      // Add to garment purchase quantity
      const quantity = parseNumberValue(item['Received Qty']);
      garmentPurchaseQuantity += quantity;
      
      // Track this item as coming from a garment supplier
      garmentSupplierItems.add(itemId);
    }
    
    if (supplierName.includes('fabric') && itemId) {
      // Ignore specific invoice number for fabric purchase quantity calculation
      const invoiceNumber = item['Invoice Number'];
      if (invoiceNumber !== '9000322583') {
        // Add to fabric purchase quantity
        const quantity = parseNumberValue(item['Received Qty']);
        fabricPurchaseQuantity += quantity;
      }
      
      // Always track this item as coming from a fabric supplier
      // (still track it for sale purposes, we just don't count it in purchase quantity)
      fabricSupplierItems.add(itemId);
    }
  });
  
  // Check sales data for items from garment suppliers
  salesTaxData.forEach(item => {
    const itemId = item['Item Id']?.toString();
    const quantity = parseNumberValue(item['Qty']);
    
    // Process garment sales
    if (itemId && garmentSupplierItems.has(itemId)) {
      // Add to garment sale quantity
      garmentSaleQuantity += quantity;
      
      // Get the sale date
      let saleDate = item['Date'] || 'Unknown Date';
      
      // Standardize date format if possible
      if (saleDate !== 'Unknown Date') {
        try {
          // Now parseDate returns a string in YYYY-MM-DD format
          saleDate = parseDate(saleDate);
          // No need for Date object conversion anymore
        } catch (e) {
          // Keep original format if parsing fails
        }
      }
      
      // Update sales by date
      if (!garmentSalesByDate.has(saleDate)) {
        garmentSalesByDate.set(saleDate, {
          date: saleDate,
          quantity: 0,
          amount: 0
        });
      }
      
      const dateEntry = garmentSalesByDate.get(saleDate);
      dateEntry.quantity += quantity;
      dateEntry.amount += (parseNumberValue(item['Net Amount']) + parseNumberValue(item['CGST Tax Amount']) + parseNumberValue(item['SGST Tax Amount']));
    }
    
    // Process fabric sales
    if (itemId && fabricSupplierItems.has(itemId)) {
      // Add to fabric sale quantity
      fabricSaleQuantity += quantity;
      
      // Get the sale date
      let saleDate = item['Date'] || 'Unknown Date';
      
      // Standardize date format if possible
      if (saleDate !== 'Unknown Date') {
        try {
          // Now parseDate returns a string in YYYY-MM-DD format
          saleDate = parseDate(saleDate);
          // No need for Date object conversion anymore
        } catch (e) {
          // Keep original format if parsing fails
        }
      }
      
      // Update sales by date
      if (!fabricSalesByDate.has(saleDate)) {
        fabricSalesByDate.set(saleDate, {
          date: saleDate,
          quantity: 0,
          amount: 0
        });
      }
      
      const dateEntry = fabricSalesByDate.get(saleDate);
      dateEntry.quantity += quantity;
      dateEntry.amount += (parseNumberValue(item['Net Amount']) + parseNumberValue(item['CGST Tax Amount']) + parseNumberValue(item['SGST Tax Amount']));
    }
  });
  
  // Convert sales by date to sorted array for garment
  const garmentSalesDateArray = Array.from(garmentSalesByDate.values());
  garmentSalesDateArray.sort((a, b) => a.date.localeCompare(b.date));
  
  // Convert sales by date to sorted array for fabric
  const fabricSalesDateArray = Array.from(fabricSalesByDate.values());
  fabricSalesDateArray.sort((a, b) => a.date.localeCompare(b.date));
  
  // Generate summary with focus on totals
  const summary = {
    // Data counts
    purchaseOrderCount: purchaseOrderData.length,
    salesTaxCount: salesTaxData.length,
    matchedCount: matchedData.length,
    salesWithoutPurchaseCount: salesWithoutPurchase.length,
    unusedPurchasesCount: unusedPurchases.length,
    
    // Financial totals
    totalPurchaseAmount,
    totalSaleAmount,
    totalNetSaleAmount,
    totalNetPurchaseAmount,
    totalCGSTAmount,
    totalSGSTAmount,
    totalNetProfit,
    difference: totalSaleAmount - totalPurchaseAmount,
    
    // GST breakdown by rate
    gstBreakdownByRate,
    
    // Garment quantities
    garmentPurchaseQuantity,
    garmentSaleQuantity,
    
    // Fabric quantities
    fabricPurchaseQuantity,
    fabricSaleQuantity,
    
    // Profit Percentage
    profitPercentage: totalPurchaseAmount > 0 
      ? ((totalSaleAmount - totalPurchaseAmount) / totalPurchaseAmount * 100).toFixed(2) + '%'
      : 'N/A',
      
    // Commission Percentage (Profit/Sale)
    commissionPercentage: totalSaleAmount > 0
      ? ((totalSaleAmount - totalPurchaseAmount) / totalSaleAmount * 100).toFixed(2) + '%'
      : 'N/A',
      
    // Net Profit Percentage
    netProfitPercentage: totalNetPurchaseAmount > 0
      ? (totalNetProfit / totalNetPurchaseAmount * 100).toFixed(2) + '%'
      : 'N/A'
  };
  
  // Group data by supplier name
  const supplierGroupedData = groupDataBySupplier(matchedData);
  
  // Generate a more descriptive summary text
  const summaryText = `
Summary:
-----------------------------------------
Total Purchase Amount: ${totalPurchaseAmount.toFixed(2)}
Total Sale Amount: ${totalSaleAmount.toFixed(2)}
Gross Profit (Sale - Purchase): ${(totalSaleAmount - totalPurchaseAmount).toFixed(2)}
Profit Percentage: ${summary.profitPercentage}
Commission Percentage: ${summary.commissionPercentage}

Net Profit Summary:
-----------------------------------------
Total Net Sale Amount (Without Tax): ${totalNetSaleAmount.toFixed(2)}
Total Net Purchase Amount (Without Tax): ${totalNetPurchaseAmount.toFixed(2)}
Net Profit (Net Sale - Net Purchase): ${totalNetProfit.toFixed(2)}
Net Profit Percentage: ${summary.netProfitPercentage}

GST Summary:
-----------------------------------------
Total CGST: ${totalCGSTAmount.toFixed(2)}
Total SGST: ${totalSGSTAmount.toFixed(2)}
Total GST: ${(totalCGSTAmount + totalSGSTAmount).toFixed(2)}

GST Breakdown by Rate:
-----------------------------------------
${gstBreakdownByRate.map(entry => 
  `Rate ${entry.rate}: 
   Sale GST: ₹${entry.totalAmount.toFixed(2)} (CGST: ₹${entry.cgstAmount.toFixed(2)}, SGST: ₹${entry.sgstAmount.toFixed(2)})
   Purchase GST: ₹${entry.purchaseGstAmount.toFixed(2)} (CGST: ₹${entry.purchaseCgstAmount.toFixed(2)}, SGST: ₹${entry.purchaseSgstAmount.toFixed(2)})
   Net GST: ₹${entry.netGstAmount.toFixed(2)} (${entry.items} items)`
).join('\n')}

Garment Supplier Summary:
-----------------------------------------
Garment Purchase Quantity: ${garmentPurchaseQuantity.toFixed(2)}
Garment Sale Quantity: ${garmentSaleQuantity.toFixed(2)}

Fabric Supplier Summary:
-----------------------------------------
Fabric Purchase Quantity: ${fabricPurchaseQuantity.toFixed(2)}
Fabric Sale Quantity: ${fabricSaleQuantity.toFixed(2)}

Data Statistics:
-----------------------------------------
Purchase Orders: ${summary.purchaseOrderCount}
Sales Transactions: ${summary.salesTaxCount}
Matched Records: ${summary.matchedCount}
Sales Without Matching Purchase: ${summary.salesWithoutPurchaseCount}
Unused Purchases: ${summary.unusedPurchasesCount}
`;
  
  return {
    purchaseOrderData,
    salesTaxData,
    matchedData,
    salesWithoutPurchase,
    unusedPurchases,
    supplierGroupedData,
    invoiceGroupedData,
    garmentSalesDateArray,
    fabricSalesDateArray,
    summary,
    summaryText,
    gstBreakdownByRate
  };
}

/**
 * Groups purchase orders by invoice number and calculates total values
 * @param {Array} purchaseOrderData - Array of purchase order data
 * @returns {Array} Array of invoice-grouped summaries
 */
function groupPurchaseOrdersByInvoice(purchaseOrderData) {
  // Create a map to store invoice grouped data
  const invoiceMap = new Map();
  
  // Process each purchase order item
  purchaseOrderData.forEach(item => {
    const invoiceNumber = item['Invoice Number'] || 'Unknown Invoice';
    const grossValue = parseNumberValue(item['Gross Value']) || 0;
    const receivedQty = parseNumberValue(item['Received Qty']) || 0;
    
    // Get or create invoice entry
    if (!invoiceMap.has(invoiceNumber)) {
      invoiceMap.set(invoiceNumber, {
        invoiceNumber,
        grossValue: 0,
        totalQuantity: 0,
        itemCount: 0,
        supplierName: item['Suppiler Name'] || 'Unknown Supplier',
        invoiceDate: item['Invoice Date'] || ''
      });
    }
    
    // Update invoice totals
    const invoiceData = invoiceMap.get(invoiceNumber);
    invoiceData.grossValue += grossValue;
    invoiceData.totalQuantity += receivedQty;
    invoiceData.itemCount++;
  });
  
  // Convert map to array
  const result = Array.from(invoiceMap.values());
  
  // Sort by invoice number
  result.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  
  // Add a total row
  const totalRow = {
    invoiceNumber: 'Total',
    grossValue: result.reduce((sum, invoice) => sum + invoice.grossValue, 0),
    totalQuantity: result.reduce((sum, invoice) => sum + invoice.totalQuantity, 0),
    itemCount: result.reduce((sum, invoice) => sum + invoice.itemCount, 0),
    supplierName: '',
    invoiceDate: ''
  };
  
  result.push(totalRow);
  
  return result;
}

/**
 * Groups financial data by supplier name
 * @param {Array} matchedData - Array of matched sales and purchase data
 * @returns {Array} Array of supplier grouped summaries
 */
function groupDataBySupplier(matchedData) {
  // Create a map to store supplier grouped data
  const supplierMap = new Map();
  
  // Process each matched data item
  matchedData.forEach(item => {
    const supplierName = item['Suppiler Name'] || 'Unknown Supplier';
    const purchaseAmount = parseNumberValue(item['Total Purchase Amount']) || 0;
    const saleAmount = parseNumberValue(item['Total Sale Amount']) || 0;
    
    // Get or create supplier entry
    if (!supplierMap.has(supplierName)) {
      supplierMap.set(supplierName, {
        supplierName,
        purchaseAmount: 0,
        saleAmount: 0,
        count: 0
      });
    }
    
    // Update supplier totals
    const supplierData = supplierMap.get(supplierName);
    supplierData.purchaseAmount += purchaseAmount;
    supplierData.saleAmount += saleAmount;
    supplierData.count++;
  });
  
  // Convert map to array and calculate percentages
  const result = Array.from(supplierMap.values()).map(supplier => {
    const profit = supplier.saleAmount - supplier.purchaseAmount;
    const profitPercentage = supplier.purchaseAmount > 0 
      ? (profit / supplier.purchaseAmount * 100).toFixed(2)
      : 0;
    const commissionPercentage = supplier.saleAmount > 0
      ? (profit / supplier.saleAmount * 100).toFixed(2)
      : 0;
      
    return {
      supplierName: supplier.supplierName,
      purchaseAmount: supplier.purchaseAmount,
      saleAmount: supplier.saleAmount,
      profit,
      profitPercentage,
      commissionPercentage,
      count: supplier.count
    };
  });
  
  // Sort by profit in descending order
  result.sort((a, b) => b.profit - a.profit);
  
  // Add a total row
  const totalRow = {
    supplierName: 'Total',
    purchaseAmount: result.reduce((sum, supplier) => sum + supplier.purchaseAmount, 0),
    saleAmount: result.reduce((sum, supplier) => sum + supplier.saleAmount, 0),
    count: result.reduce((sum, supplier) => sum + supplier.count, 0)
  };
  
  totalRow.profit = totalRow.saleAmount - totalRow.purchaseAmount;
  totalRow.profitPercentage = totalRow.purchaseAmount > 0 
    ? (totalRow.profit / totalRow.purchaseAmount * 100).toFixed(2)
    : 0;
  totalRow.commissionPercentage = totalRow.saleAmount > 0
    ? (totalRow.profit / totalRow.saleAmount * 100).toFixed(2)
    : 0;
  
  result.push(totalRow);
  
  return result;
}

// Helper function to prefix keys in an object to avoid collisions
function prefixKeys(obj, prefix, exceptions = []) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (exceptions.includes(key)) {
      result[key] = value;
    } else {
      result[`${prefix}${key}`] = value;
    }
  }
  
  return result;
}
