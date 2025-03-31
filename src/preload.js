// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send the file paths to the main process for processing
  processExcelFiles: (purchaseOrderFilePath, salesTaxFilePath) => {
    return ipcRenderer.invoke('process-excel-files', purchaseOrderFilePath, salesTaxFilePath);
  },
  // Open file dialog and return selected file path
  openFile: (title) => {
    return ipcRenderer.invoke('dialog:openFile', title);
  }
});
