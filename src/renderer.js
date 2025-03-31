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
      col.className = 'col-md-6 col-lg-3';
      
      col.innerHTML = `
        <div class="card h-100">
          <div class="card-body p-3">
            <div class="financial-highlight">
              <div class="highlight-label">${label}</div>
              <div class="highlight-value ${colorClass}">${value}</div>
            </div>
          </div>
        </div>
      `;
      return col;
    }
    
    // Format currency values
    const formatCurrency = (value) => {
      return parseFloat(value).toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      });
    };
    
    // Add financial cards
    const totalPurchase = formatCurrency(result.summary.totalPurchaseAmount || 0);
    const totalSale = formatCurrency(result.summary.totalSaleAmount || 0);
    const difference = formatCurrency(result.summary.difference || 0);
    const isDifferencePositive = (result.summary.difference || 0) >= 0;
    
    highlightsRow.appendChild(createHighlightCard('Total Purchase', totalPurchase, 'neutral'));
    highlightsRow.appendChild(createHighlightCard('Total Sale', totalSale, 'neutral'));
    highlightsRow.appendChild(createHighlightCard('Profit', difference, isDifferencePositive ? 'positive' : 'negative'));
    highlightsRow.appendChild(createHighlightCard('Profit %', result.summary.profitPercentage || 'N/A', isDifferencePositive ? 'positive' : 'negative'));
    
    summarySection.appendChild(highlightsRow);
    
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
