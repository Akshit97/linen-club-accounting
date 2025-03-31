// This file handles the UI logic for the application

document.addEventListener('DOMContentLoaded', () => {
  const purchaseOrderInput = document.getElementById('purchaseOrderFile');
  const salesTaxInput = document.getElementById('salesTaxFile');
  const processBtn = document.getElementById('processBtn');
  const resultsDiv = document.getElementById('results');
  const loadingSpinner = document.getElementById('loadingSpinner');
  
  // Store selected file paths
  let purchaseOrderPath = null;
  let salesTaxPath = null;

  // Purchase order file selection
  purchaseOrderInput.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile('Select Purchase Order Report');
    if (filePath) {
      purchaseOrderPath = filePath;
      const fileNameOnly = filePath.split('/').pop();
      updateFileSelectionUI(purchaseOrderInput, fileNameOnly);
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

  // Helper function to update UI after file selection
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
    if (!purchaseOrderPath || !salesTaxPath) {
      showError('Please select both Purchase Order and Sales Tax reports');
      return;
    }

    // Show loading spinner
    toggleLoading(true);

    try {
      // Send files to the main process for processing via IPC
      const result = await window.electronAPI.processExcelFiles(
        purchaseOrderPath, 
        salesTaxPath
      );
      
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
    
    // Add Garment Supplier Summary
    const garmentRow = document.createElement('div');
    garmentRow.className = 'row g-3 mb-4';
    
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
    
    // Add garment quantity cards
    garmentRow.appendChild(createInfoCard(
      'Garment Purchase Quantity', 
      formatQuantity(result.summary.garmentPurchaseQuantity)
    ));
    
    garmentRow.appendChild(createInfoCard(
      'Garment Sale Quantity', 
      formatQuantity(result.summary.garmentSaleQuantity)
    ));
    
    // Create container for garment summary
    const garmentSummaryCard = document.createElement('div');
    garmentSummaryCard.className = 'card mb-4';
    garmentSummaryCard.innerHTML = `
      <div class="card-header bg-primary text-white">
        <i class="bi bi-layers me-2"></i>Garment Summary
      </div>
      <div class="card-body">
        <p class="text-muted mb-3">Summary of purchases and sales for products from suppliers with "garment" in their name</p>
        <div id="garment-quantity-cards"></div>
        
        ${result.garmentSalesDateArray && result.garmentSalesDateArray.length > 0 ? `
          <h5 class="mt-4 mb-3">Garment Sales by Date</h5>
          <div class="table-responsive">
            <table class="table table-hover table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-end">Quantity</th>
                  <th class="text-end">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${result.garmentSalesDateArray.map(entry => `
                  <tr>
                    <td>${entry.date}</td>
                    <td class="text-end">${formatQuantity(entry.quantity)}</td>
                    <td class="text-end">₹${formatQuantity(entry.amount)}</td>
                  </tr>
                `).join('')}
                <tr class="table-primary fw-bold">
                  <td>Total</td>
                  <td class="text-end">${formatQuantity(result.summary.garmentSaleQuantity)}</td>
                  <td class="text-end">₹${formatQuantity(result.garmentSalesDateArray.reduce((sum, entry) => sum + entry.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
    
    const garmentCardsContainer = garmentSummaryCard.querySelector('#garment-quantity-cards');
    garmentCardsContainer.appendChild(garmentRow);
    
    summarySection.appendChild(garmentSummaryCard);
    
    // Add Fabric Supplier Summary
    const fabricRow = document.createElement('div');
    fabricRow.className = 'row g-3 mb-4';
    
    // Add fabric quantity cards
    fabricRow.appendChild(createInfoCard(
      'Fabric Purchase Quantity', 
      formatQuantity(result.summary.fabricPurchaseQuantity)
    ));
    
    fabricRow.appendChild(createInfoCard(
      'Fabric Sale Quantity', 
      formatQuantity(result.summary.fabricSaleQuantity)
    ));
    
    // Create container for fabric summary
    const fabricSummaryCard = document.createElement('div');
    fabricSummaryCard.className = 'card mb-4';
    fabricSummaryCard.innerHTML = `
      <div class="card-header bg-primary text-white">
        <i class="bi bi-grid-3x3 me-2"></i>Fabric Summary
      </div>
      <div class="card-body">
        <p class="text-muted mb-3">Summary of purchases and sales for products from suppliers with "fabric" in their name</p>
        <div id="fabric-quantity-cards"></div>
        
        ${result.fabricSalesDateArray && result.fabricSalesDateArray.length > 0 ? `
          <h5 class="mt-4 mb-3">Fabric Sales by Date</h5>
          <div class="table-responsive">
            <table class="table table-hover table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-end">Quantity</th>
                  <th class="text-end">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${result.fabricSalesDateArray.map(entry => `
                  <tr>
                    <td>${entry.date}</td>
                    <td class="text-end">${formatQuantity(entry.quantity)}</td>
                    <td class="text-end">₹${formatQuantity(entry.amount)}</td>
                  </tr>
                `).join('')}
                <tr class="table-primary fw-bold">
                  <td>Total</td>
                  <td class="text-end">${formatQuantity(result.summary.fabricSaleQuantity)}</td>
                  <td class="text-end">₹${formatQuantity(result.fabricSalesDateArray.reduce((sum, entry) => sum + entry.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
    
    const fabricCardsContainer = fabricSummaryCard.querySelector('#fabric-quantity-cards');
    fabricCardsContainer.appendChild(fabricRow);
    
    summarySection.appendChild(fabricSummaryCard);
    
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
