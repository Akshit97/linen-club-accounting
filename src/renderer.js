// This file handles the UI logic for the application

document.addEventListener('DOMContentLoaded', () => {
  const purchaseOrderInput = document.getElementById('purchaseOrderFile');
  const salesTaxInput = document.getElementById('salesTaxFile');
  const processBtn = document.getElementById('processBtn');
  const resultsDiv = document.getElementById('results');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const fileCountBadge = document.getElementById('fileCountBadge');
  const selectedFilesList = document.getElementById('selectedFilesList');
  
  // Store selected file paths
  let purchaseOrderPaths = [];
  let salesTaxPath = null;

  // Purchase order file selection - now handles multiple files
  purchaseOrderInput.addEventListener('click', async () => {
    const filePaths = await window.electronAPI.openMultipleFiles('Select Purchase Order Report(s)');
    if (filePaths && filePaths.length > 0) {
      purchaseOrderPaths = filePaths;
      updatePurchaseOrderSelectionUI(filePaths);
    }
  });

  // Sales tax file selection
  salesTaxInput.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile('Select Sales Tax Report');
    if (filePath) {
      salesTaxPath = filePath;
      const fileNameOnly = filePath.split('/').pop();
      updateFileSelectionUI(salesTaxInput, fileNameOnly);
    }
  });

  // Helper function to update Purchase Order selection UI for multiple files
  function updatePurchaseOrderSelectionUI(filePaths) {
    // Add selected class to the upload box
    purchaseOrderInput.classList.add('file-selected');
    
    // Update text content
    const textSpan = purchaseOrderInput.querySelector('span');
    if (textSpan) {
      textSpan.textContent = `${filePaths.length} file(s) selected`;
    }
    
    // Add a file icon if not already present
    const icon = purchaseOrderInput.querySelector('i');
    if (icon) {
      icon.className = 'bi bi-file-earmark-check d-block';
    }
    
    // Update file count badge
    fileCountBadge.textContent = filePaths.length;
    fileCountBadge.classList.remove('d-none');
    
    // Update the files list
    selectedFilesList.innerHTML = '';
    selectedFilesList.classList.remove('d-none');
    
    filePaths.forEach((path, index) => {
      const fileNameOnly = path.split('/').pop();
      const fileItem = document.createElement('div');
      fileItem.className = 'selected-file-item';
      fileItem.innerHTML = `
        <div class="text-truncate" title="${fileNameOnly}" style="max-width: 90%;">
          ${index + 1}. ${fileNameOnly}
        </div>
      `;
      selectedFilesList.appendChild(fileItem);
    });
  }

  // Helper function to update UI after single file selection
  function updateFileSelectionUI(element, fileName) {
    // Add selected class to the upload box
    element.classList.add('file-selected');
    
    // Update text content
    const textSpan = element.querySelector('span');
    if (textSpan) {
      textSpan.textContent = `Selected: ${fileName}`;
    }
    
    // Add a file icon if not already present
    const icon = element.querySelector('i');
    if (icon) {
      icon.className = 'bi bi-file-earmark-check d-block';
    }
  }

  // Process button click handler
  processBtn.addEventListener('click', async () => {
    // Validate inputs
    if (purchaseOrderPaths.length === 0 || !salesTaxPath) {
      showError('Please select both Purchase Order and Sales Tax reports');
      return;
    }

    // Show loading spinner
    toggleLoading(true);

    try {
      let result;
      
      if (purchaseOrderPaths.length === 1) {
        // Single file processing
        result = await window.electronAPI.processExcelFiles(
          purchaseOrderPaths[0], 
          salesTaxPath
        );
      } else {
        // Multiple files processing
        result = await window.electronAPI.processMultipleExcelFiles(
          purchaseOrderPaths, 
          salesTaxPath
        );
      }
      
      // Display results
      displayResults(result);
    } catch (error) {
      showError(`Error processing files: ${error.message}`);
    } finally {
      // Hide loading spinner
      toggleLoading(false);
    }
  });

  // Function to display processing results
  function displayResults(result) {
    if (!result || !result.success) {
      showError(result?.message || 'An unknown error occurred');
      return;
    }

    // Clear previous results
    resultsDiv.innerHTML = '';

    // Create container for all results
    const container = document.createElement('div');
    
    // Add success message
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success mb-4';
    successAlert.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi bi-check-circle-fill me-3" style="font-size: 1.5rem;"></i>
        <div>
          <strong>Analysis Complete!</strong> Reports processed successfully.
          <div class="small text-muted">Files saved to your computer.</div>
        </div>
      </div>
    `;
    container.appendChild(successAlert);

    // Financial summary section
    const summarySection = document.createElement('div');
    summarySection.className = 'mb-4';
    
    // Create a row for financial highlights
    const highlightsRow = document.createElement('div');
    highlightsRow.className = 'row g-3 mb-4';
    
    // Helper to create financial highlight cards
    function createHighlightCard(label, value, colorClass) {
      const col = document.createElement('div');
      col.className = 'col-sm-6 col-lg-3';
      
      col.innerHTML = `
        <div class="card h-100">
          <div class="card-body p-3">
            <div class="financial-highlight">
              <div class="highlight-label">${label}</div>
              <div class="highlight-value ${colorClass}" style="white-space: nowrap;">${value}</div>
            </div>
          </div>
        </div>
      `;
      return col;
    }
    
    // Format currency values with full numbers
    const formatCurrency = (value) => {
      const numValue = parseFloat(value) || 0;
      return numValue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    
    // Add financial cards
    const totalPurchase = formatCurrency(result.summary.totalPurchaseAmount || 0);
    const totalSale = formatCurrency(result.summary.totalSaleAmount || 0);
    const difference = formatCurrency(result.summary.difference || 0);
    const isDifferencePositive = (result.summary.difference || 0) >= 0;
    
    highlightsRow.appendChild(createHighlightCard('Total Purchase', '₹' + totalPurchase, 'neutral'));
    highlightsRow.appendChild(createHighlightCard('Total Sale', '₹' + totalSale, 'neutral'));
    highlightsRow.appendChild(createHighlightCard('Profit', '₹' + difference, isDifferencePositive ? 'positive' : 'negative'));
    highlightsRow.appendChild(createHighlightCard('Profit %', result.summary.profitPercentage || 'N/A', isDifferencePositive ? 'positive' : 'negative'));
    
    summarySection.appendChild(highlightsRow);
    
    // Helper to create a single info card
    function createInfoCard(title, content) {
      const card = document.createElement('div');
      card.className = 'col-md-6';
      card.innerHTML = `
        <div class="card h-100">
          <div class="card-header bg-light">
            <strong>${title}</strong>
          </div>
          <div class="card-body">
            <div class="d-flex align-items-center">
              <i class="bi bi-box-seam me-3 text-primary" style="font-size: 2rem;"></i>
              <div>
                <h3 class="mb-0">${content}</h3>
                <div class="text-muted small">Units</div>
              </div>
            </div>
          </div>
        </div>
      `;
      return card;
    }
    
    // Format quantity values
    const formatQuantity = (value) => parseFloat(value || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2
    });
    
    // Add Garment and Fabric Summary Cards
    const categoryRow = document.createElement('div');
    categoryRow.className = 'row g-3 mb-4';
    
    // Create summary card for garment
    const garmentSummaryCard = document.createElement('div');
    garmentSummaryCard.className = 'col-md-6';
    
    const garmentInnerCard = document.createElement('div');
    garmentInnerCard.className = 'card h-100';
    garmentInnerCard.innerHTML = `
      <div class="card-header bg-primary text-white">
        <i class="bi bi-layers me-2"></i>Garment Summary
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-6">
            <div class="border rounded p-3 text-center h-100">
              <div class="text-muted mb-1">Purchase Quantity</div>
              <div style="font-size: 20px; font-weight: 600;">${formatQuantity(result.summary.garmentPurchaseQuantity)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="border rounded p-3 text-center h-100">
              <div class="text-muted mb-1">Sale Quantity</div>
              <div style="font-size: 20px; font-weight: 600;">${formatQuantity(result.summary.garmentSaleQuantity)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    garmentSummaryCard.appendChild(garmentInnerCard);
    categoryRow.appendChild(garmentSummaryCard);
    
    // Create summary card for fabric
    const fabricSummaryCard = document.createElement('div');
    fabricSummaryCard.className = 'col-md-6';
    
    const fabricInnerCard = document.createElement('div');
    fabricInnerCard.className = 'card h-100';
    fabricInnerCard.innerHTML = `
      <div class="card-header bg-success text-white">
        <i class="bi bi-grid-3x3 me-2"></i>Fabric Summary
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-6">
            <div class="border rounded p-3 text-center h-100">
              <div class="text-muted mb-1">Purchase Quantity</div>
              <div style="font-size: 20px; font-weight: 600;">${formatQuantity(result.summary.fabricPurchaseQuantity)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="border rounded p-3 text-center h-100">
              <div class="text-muted mb-1">Sale Quantity</div>
              <div style="font-size: 20px; font-weight: 600;">${formatQuantity(result.summary.fabricSaleQuantity)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    fabricSummaryCard.appendChild(fabricInnerCard);
    categoryRow.appendChild(fabricSummaryCard);
    
    summarySection.appendChild(categoryRow);
    
    // Add Supplier Profit Report
    if (result.supplierGroupedData && result.supplierGroupedData.length > 0) {
      const supplierReportCard = document.createElement('div');
      supplierReportCard.className = 'card mb-4';
      supplierReportCard.innerHTML = `
        <div class="card-header">
          <i class="bi bi-shop me-2"></i>Supplier Profit Report
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover table-striped mb-0">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th class="text-end" style="white-space: nowrap;">Purchase</th>
                  <th class="text-end" style="white-space: nowrap;">Sale</th>
                  <th class="text-end" style="white-space: nowrap;">Profit</th>
                  <th class="text-end" style="white-space: nowrap;">Profit %</th>
                  <th class="text-end" style="white-space: nowrap;">Commission %</th>
                </tr>
              </thead>
              <tbody>
                ${result.supplierGroupedData.map(supplier => {
                  const isTotal = supplier.supplierName === 'Total';
                  const rowClass = isTotal ? 'table-primary fw-bold' : '';
                  const profitClass = parseFloat(supplier.profit) >= 0 ? 'text-success' : 'text-danger';
                  
                  // Format all numeric values with consistent formatting
                  const formatNumber = (value) => {
                    return parseFloat(value).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    });
                  };
                  
                  return `
                    <tr class="${rowClass}">
                      <td>${supplier.supplierName}</td>
                      <td class="text-end" style="white-space: nowrap;">₹${formatNumber(supplier.purchaseAmount)}</td>
                      <td class="text-end" style="white-space: nowrap;">₹${formatNumber(supplier.saleAmount)}</td>
                      <td class="text-end ${profitClass}" style="white-space: nowrap;">₹${formatNumber(supplier.profit)}</td>
                      <td class="text-end" style="white-space: nowrap;">${supplier.profitPercentage}%</td>
                      <td class="text-end" style="white-space: nowrap;">${supplier.commissionPercentage}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      summarySection.appendChild(supplierReportCard);
    }
    
    // Add Combined Sales by Date Summary
    const combinedSalesCard = document.createElement('div');
    combinedSalesCard.className = 'card mb-4';
    
    // Create a map to combine garment and fabric sales by date
    const combinedSalesByDate = new Map();
    
    // Add garment sales to combined map
    if (result.garmentSalesDateArray && result.garmentSalesDateArray.length > 0) {
      result.garmentSalesDateArray.forEach(entry => {
        if (!combinedSalesByDate.has(entry.date)) {
          combinedSalesByDate.set(entry.date, {
            date: entry.date,
            totalQuantity: 0,
            totalAmount: 0,
            garmentQuantity: 0,
            garmentAmount: 0,
            fabricQuantity: 0,
            fabricAmount: 0
          });
        }
        
        const combinedEntry = combinedSalesByDate.get(entry.date);
        combinedEntry.garmentQuantity += entry.quantity;
        combinedEntry.garmentAmount += entry.amount;
        combinedEntry.totalQuantity += entry.quantity;
        combinedEntry.totalAmount += entry.amount;
      });
    }
    
    // Add fabric sales to combined map
    if (result.fabricSalesDateArray && result.fabricSalesDateArray.length > 0) {
      result.fabricSalesDateArray.forEach(entry => {
        if (!combinedSalesByDate.has(entry.date)) {
          combinedSalesByDate.set(entry.date, {
            date: entry.date,
            totalQuantity: 0,
            totalAmount: 0,
            garmentQuantity: 0,
            garmentAmount: 0,
            fabricQuantity: 0,
            fabricAmount: 0
          });
        }
        
        const combinedEntry = combinedSalesByDate.get(entry.date);
        combinedEntry.fabricQuantity += entry.quantity;
        combinedEntry.fabricAmount += entry.amount;
        combinedEntry.totalQuantity += entry.quantity;
        combinedEntry.totalAmount += entry.amount;
      });
    }
    
    // Convert to array and sort
    const combinedSalesArray = Array.from(combinedSalesByDate.values());
    combinedSalesArray.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate combined totals
    const totalCombinedQuantity = combinedSalesArray.reduce((sum, entry) => sum + entry.totalQuantity, 0);
    const totalCombinedAmount = combinedSalesArray.reduce((sum, entry) => sum + entry.totalAmount, 0);
    const totalGarmentQuantity = combinedSalesArray.reduce((sum, entry) => sum + entry.garmentQuantity, 0);
    const totalGarmentAmount = combinedSalesArray.reduce((sum, entry) => sum + entry.garmentAmount, 0);
    const totalFabricQuantity = combinedSalesArray.reduce((sum, entry) => sum + entry.fabricQuantity, 0);
    const totalFabricAmount = combinedSalesArray.reduce((sum, entry) => sum + entry.fabricAmount, 0);
    
    // Create the combined sales card content
    combinedSalesCard.innerHTML = `
      <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <div>
          <i class="bi bi-calendar3 me-2"></i>Combined Sales by Date
        </div>
        <div>
          <span class="badge bg-light text-dark me-2">Total: ${formatQuantity(totalCombinedQuantity)} units</span>
          <span class="badge bg-light text-dark">₹${formatQuantity(totalCombinedAmount)}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="d-flex justify-content-center mb-3">
          <div class="d-flex gap-2 flex-wrap">
            <span class="badge bg-primary py-2 px-3">
              <i class="bi bi-layers me-1"></i> Garment: ${formatQuantity(totalGarmentQuantity)} units / ₹${formatQuantity(totalGarmentAmount)}
            </span>
            <span class="badge bg-success py-2 px-3">
              <i class="bi bi-grid-3x3 me-1"></i> Fabric: ${formatQuantity(totalFabricQuantity)} units / ₹${formatQuantity(totalFabricAmount)}
            </span>
          </div>
        </div>
        
        ${combinedSalesArray.length > 0 ? `
          <div class="table-responsive">
            <table class="table table-hover table-striped" id="combined-sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-end">Quantity</th>
                  <th class="text-end">Amount (₹)</th>
                  <th class="text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                ${combinedSalesArray.map((entry, index) => `
                  <tr>
                    <td>${entry.date}</td>
                    <td class="text-end">${formatQuantity(entry.totalQuantity)}</td>
                    <td class="text-end">₹${formatQuantity(entry.totalAmount)}</td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-outline-secondary details-toggle-btn" data-index="${index}">
                        <i class="bi bi-chevron-down"></i>
                      </button>
                    </td>
                  </tr>
                  <tr class="details-row" id="details-row-${index}" style="display: none;">
                    <td colspan="4" class="p-0">
                      <div class="card card-body border-0 m-0">
                        <div class="row">
                          <div class="col-md-6">
                            <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                              <span><i class="bi bi-layers me-1 text-primary"></i> <strong>Garment</strong></span>
                              <span>
                                ${entry.garmentQuantity > 0 ? 
                                  `${formatQuantity(entry.garmentQuantity)} units / ₹${formatQuantity(entry.garmentAmount)}` : 
                                  'No data'}
                              </span>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                              <span><i class="bi bi-grid-3x3 me-1 text-success"></i> <strong>Fabric</strong></span>
                              <span>
                                ${entry.fabricQuantity > 0 ? 
                                  `${formatQuantity(entry.fabricQuantity)} units / ₹${formatQuantity(entry.fabricAmount)}` : 
                                  'No data'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
                <tr class="table-primary fw-bold">
                  <td>Total</td>
                  <td class="text-end">${formatQuantity(totalCombinedQuantity)}</td>
                  <td class="text-end">₹${formatQuantity(totalCombinedAmount)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : '<div class="alert alert-info">No sales data available</div>'}
      </div>
    `;
    
    summarySection.appendChild(combinedSalesCard);
    
    // Add event listeners for details toggle buttons after the card is added to the DOM
    setTimeout(() => {
      const detailButtons = document.querySelectorAll('.details-toggle-btn');
      detailButtons.forEach(btn => {
        btn.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          const detailsRow = document.getElementById(`details-row-${index}`);
          const icon = this.querySelector('i');
          
          if (detailsRow.style.display === 'none') {
            detailsRow.style.display = 'table-row';
            icon.classList.remove('bi-chevron-down');
            icon.classList.add('bi-chevron-up');
          } else {
            detailsRow.style.display = 'none';
            icon.classList.remove('bi-chevron-up');
            icon.classList.add('bi-chevron-down');
          }
        });
      });
    }, 100);
    
    // Add Invoice Summary Report
    if (result.invoiceGroupedData && result.invoiceGroupedData.length > 0) {
      const invoiceReportCard = document.createElement('div');
      invoiceReportCard.className = 'card mb-4';
      invoiceReportCard.innerHTML = `
        <div class="card-header">
          <i class="bi bi-receipt me-2"></i>Invoice Summary Report
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover table-striped mb-0">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Supplier Name</th>
                  <th>Invoice Date</th>
                  <th class="text-end" style="white-space: nowrap;">Gross Value</th>
                  <th class="text-end" style="white-space: nowrap;">Total Quantity</th>
                  <th class="text-end" style="white-space: nowrap;">Items</th>
                </tr>
              </thead>
              <tbody>
                ${result.invoiceGroupedData.map(invoice => {
                  const isTotal = invoice.invoiceNumber === 'Total';
                  const rowClass = isTotal ? 'table-primary fw-bold' : '';
                  
                  // Format all numeric values with consistent formatting
                  const formatNumber = (value) => {
                    return parseFloat(value).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    });
                  };
                  
                  return `
                    <tr class="${rowClass}">
                      <td>${invoice.invoiceNumber}</td>
                      <td>${invoice.supplierName}</td>
                      <td>${invoice.invoiceDate}</td>
                      <td class="text-end" style="white-space: nowrap;">₹${formatNumber(invoice.grossValue)}</td>
                      <td class="text-end" style="white-space: nowrap;">${formatNumber(invoice.totalQuantity)}</td>
                      <td class="text-end" style="white-space: nowrap;">${invoice.itemCount}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      summarySection.appendChild(invoiceReportCard);
    }
    
    // Add record count statistics
    const statsCard = document.createElement('div');
    statsCard.className = 'card mb-4';
    statsCard.innerHTML = `
      <div class="card-header">
        <i class="bi bi-clipboard-data me-2"></i>Data Statistics
      </div>
      <div class="card-body p-3">
        <div class="row g-2">
          <div class="col-md-4">
            <div class="border rounded p-3 text-center">
              <div style="font-size: 24px; font-weight: 700;">${result.summary.purchaseOrderCount || 0}</div>
              <div class="text-muted">Purchase Orders</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="border rounded p-3 text-center">
              <div style="font-size: 24px; font-weight: 700;">${result.summary.salesTaxCount || 0}</div>
              <div class="text-muted">Sales Records</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="border rounded p-3 text-center">
              <div style="font-size: 24px; font-weight: 700;">${result.summary.matchedCount || 0}</div>
              <div class="text-muted">Matched Records</div>
            </div>
          </div>
        </div>
      </div>
    `;
    summarySection.appendChild(statsCard);
    
    // Add the summary section to the container
    container.appendChild(summarySection);
    
    // Add file output locations if available
    if (result.outputFiles) {
      const filesCard = document.createElement('div');
      filesCard.className = 'card';
      filesCard.innerHTML = `
        <div class="card-header">
          <i class="bi bi-folder me-2"></i>Output Files
        </div>
        <div class="card-body p-3">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-spreadsheet me-3 text-primary"></i>
              <div>
                <div><strong>Purchase Order Data</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.purchaseOrderOutputPath}</div>
              </div>
            </li>
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-spreadsheet me-3 text-success"></i>
              <div>
                <div><strong>Sales Tax Data</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.salesTaxOutputPath}</div>
              </div>
            </li>
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-spreadsheet me-3 text-info"></i>
              <div>
                <div><strong>Matched Data</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.matchedDataOutputPath}</div>
              </div>
            </li>
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-text me-3 text-warning"></i>
              <div>
                <div><strong>Summary</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.summaryOutputPath}</div>
              </div>
            </li>
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-spreadsheet me-3 text-secondary"></i>
              <div>
                <div><strong>Supplier Profit Report</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.supplierGroupedDataOutputPath}</div>
              </div>
            </li>
            <li class="list-group-item d-flex align-items-center">
              <i class="bi bi-file-earmark-spreadsheet me-3 text-info"></i>
              <div>
                <div><strong>Invoice Summary Report</strong></div>
                <div class="text-muted small text-break">${result.outputFiles.invoiceGroupedDataOutputPath}</div>
              </div>
            </li>
          </ul>
        </div>
      `;
      container.appendChild(filesCard);
    }
    
    resultsDiv.appendChild(container);
  }

  // Helper function to display error messages
  function showError(message) {
    resultsDiv.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <strong>Error:</strong> ${message}
      </div>
    `;
  }

  // Helper function to toggle loading spinner
  function toggleLoading(show) {
    if (show) {
      loadingSpinner.classList.remove('d-none');
      processBtn.disabled = true;
    } else {
      loadingSpinner.classList.add('d-none');
      processBtn.disabled = false;
    }
  }
});
