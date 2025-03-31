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
  purchaseOrderInput.addEventListener('click', async (event) => {
    event.preventDefault();
    const filePath = await window.electronAPI.openFile('Select Purchase Order Report');
    if (filePath) {
      purchaseOrderPath = filePath;
      const fileNameOnly = filePath.split('/').pop();
      purchaseOrderInput.setAttribute('data-file-selected', fileNameOnly);
      updateFileSelectionUI(purchaseOrderInput, fileNameOnly);
    }
  });

  // Sales tax file selection
  salesTaxInput.addEventListener('click', async (event) => {
    event.preventDefault();
    const filePath = await window.electronAPI.openFile('Select Sales Tax Report');
    if (filePath) {
      salesTaxPath = filePath;
      const fileNameOnly = filePath.split('/').pop();
      salesTaxInput.setAttribute('data-file-selected', fileNameOnly);
      updateFileSelectionUI(salesTaxInput, fileNameOnly);
    }
  });

  // Helper function to update UI after file selection
  function updateFileSelectionUI(inputElement, fileName) {
    // Create or update the file name display
    let fileNameDisplay = inputElement.nextElementSibling;
    if (!fileNameDisplay || !fileNameDisplay.classList.contains('selected-file-name')) {
      fileNameDisplay = document.createElement('div');
      fileNameDisplay.classList.add('selected-file-name', 'mt-2', 'text-info');
      inputElement.parentNode.insertBefore(fileNameDisplay, inputElement.nextSibling);
    }
    fileNameDisplay.textContent = `Selected: ${fileName}`;
    
    // Update input appearance
    inputElement.classList.add('file-selected');
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

    // Create container for summary
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'mb-4';
    
    // Add success message
    const successMessage = document.createElement('div');
    successMessage.className = 'alert alert-success mb-3';
    successMessage.textContent = 'Reports processed successfully!';
    summaryContainer.appendChild(successMessage);

    // Add output file locations
    if (result.outputFiles) {
      const outputFilesDiv = document.createElement('div');
      outputFilesDiv.className = 'alert alert-info mb-3';
      outputFilesDiv.innerHTML = `
        <strong>Output files created:</strong>
        <ul class="mt-2 mb-0">
          <li>Purchase Order Data: ${result.outputFiles.purchaseOrderOutputPath}</li>
          <li>Sales Tax Data: ${result.outputFiles.salesTaxOutputPath}</li>
          <li>Matched Data: ${result.outputFiles.matchedDataOutputPath}</li>
          <li>Summary: ${result.outputFiles.summaryOutputPath}</li>
        </ul>
      `;
      summaryContainer.appendChild(outputFilesDiv);
    }

    // Display the detailed summary information
    if (result.summaryText) {
      const summaryTextDiv = document.createElement('div');
      summaryTextDiv.className = 'card mb-3';
      summaryTextDiv.innerHTML = `
        <div class="card-header bg-primary text-white">Financial Summary</div>
        <div class="card-body">
          <pre class="mb-0">${result.summaryText}</pre>
        </div>
      `;
      summaryContainer.appendChild(summaryTextDiv);
    }
    // Otherwise fall back to the basic summary
    else {
      // Add basic summary information
      const summaryInfo = document.createElement('div');
      summaryInfo.className = 'card mb-3';
      summaryInfo.innerHTML = `
        <div class="card-header bg-primary text-white">Summary</div>
        <div class="card-body">
          <ul class="list-group">
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Total Purchase Amount:</strong>
              <span class="badge bg-primary rounded-pill">${result.summary.totalPurchaseAmount?.toFixed(2) || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Total Sale Amount:</strong>
              <span class="badge bg-success rounded-pill">${result.summary.totalSaleAmount?.toFixed(2) || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Difference (Sale - Purchase):</strong>
              <span class="badge ${result.summary.difference >= 0 ? 'bg-success' : 'bg-danger'} rounded-pill">${result.summary.difference?.toFixed(2) || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Profit Percentage:</strong>
              <span class="badge bg-info rounded-pill">${result.summary.profitPercentage || 'N/A'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Purchase Order Items:</strong>
              <span class="badge bg-secondary rounded-pill">${result.summary.purchaseOrderCount || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Sales Tax Items:</strong>
              <span class="badge bg-secondary rounded-pill">${result.summary.salesTaxCount || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Matched Items:</strong>
              <span class="badge bg-secondary rounded-pill">${result.summary.matchedCount || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Sales Without Purchase:</strong>
              <span class="badge bg-warning rounded-pill">${result.summary.salesWithoutPurchaseCount || 0}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <strong>Unused Purchases:</strong>
              <span class="badge bg-warning rounded-pill">${result.summary.unusedPurchasesCount || 0}</span>
            </li>
          </ul>
        </div>
      `;
      summaryContainer.appendChild(summaryInfo);
    }

    resultsDiv.appendChild(summaryContainer);

    // Add note about CSV files
    const csvNote = document.createElement('div');
    csvNote.className = 'alert alert-secondary';
    csvNote.innerHTML = `<strong>Note:</strong> All data has been saved as CSV files to your computer. Check the locations listed above.`;
    resultsDiv.appendChild(csvNote);
  }

  // Helper function to display error messages
  function showError(message) {
    resultsDiv.innerHTML = `
      <div class="error-message">
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
