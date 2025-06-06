import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;
let forceQuit = false; // Flag to bypass prompt if needed

// --- Validation Function ---
interface ValidationResult {
    errors: string[];
    warnings: string[];
}

function validateCIP2DataStructure(data: any, filePath: string): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.errors.push(`Invalid structure: Root level must be an object. File: ${filePath}`);
    return result;
  }

  for (const foiName in data) {
    if (!Object.prototype.hasOwnProperty.call(data, foiName)) continue;

    const foi = data[foiName];
    const foiPrefix = `FoI '${foiName}' in ${filePath}:`;

    if (typeof foi !== 'object' || foi === null || Array.isArray(foi)) {
      result.errors.push(`${foiPrefix} Invalid structure: Must be an object.`);
      continue; // Skip further checks for this FoI if its structure is wrong
    }

    if (typeof foi.included !== 'boolean') {
      result.errors.push(`${foiPrefix} Missing or invalid 'included' field (must be boolean).`);
    }

    if (!Array.isArray(foi.programs)) {
      result.errors.push(`${foiPrefix} Missing or invalid 'programs' field (must be an array).`);
      // If programs array is missing, we can't check individual programs
      continue;
    }

    // Non-fatal check: Population data (PRD 4.2)
    if (typeof foi.population !== 'object' || foi.population === null) {
        result.warnings.push(`${foiPrefix} Missing 'population' object. Displaying N/A.`);
    } else {
        if (typeof foi.population.count !== 'number') {
             result.warnings.push(`${foiPrefix} Missing or invalid 'population.count'. Displaying N/A.`);
        }
        if (typeof foi.population.as_of !== 'string') {
             result.warnings.push(`${foiPrefix} Missing or invalid 'population.as_of'. Displaying N/A.`);
        }
    }

    foi.programs.forEach((program: any, index: number) => {
      const programPrefix = `${foiPrefix} Program index ${index}:`;

      if (typeof program !== 'object' || program === null || Array.isArray(program)) {
        result.errors.push(`${programPrefix} Invalid structure: Must be an object.`);
        return; // Skip further checks for this program
      }

      if (typeof program.name !== 'string' || !program.name) {
        result.errors.push(`${programPrefix} Missing or invalid 'name' field (must be a non-empty string).`);
      }
      if (typeof program.link !== 'string' || !program.link) {
        result.errors.push(`${programPrefix} Missing or invalid 'link' field (must be a non-empty string).`);
      } else {
        // Basic URL validation
        try {
          new URL(program.link);
        } catch (_) {
          result.errors.push(`${programPrefix} Invalid URL format for 'link' field: "${program.link}".`);
        }
      }
      if (typeof program.included !== 'boolean') {
        result.errors.push(`${programPrefix} Missing or invalid 'included' field (must be boolean).`);
      }

      // Non-fatal checks: degree, description (PRD 4.2)
      if (program.degree !== undefined && program.degree !== null && typeof program.degree !== 'string') {
        result.warnings.push(`${programPrefix} Invalid 'degree' field (should be string or null/undefined). Displaying empty.`);
      }
      if (program.description !== undefined && program.description !== null && typeof program.description !== 'string') {
         result.warnings.push(`${programPrefix} Invalid 'description' field (should be string or null/undefined). Displaying empty.`);
      }
    });
  }

  return result;
}
// --- End Validation Function ---

async function handleAppReady() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) return;

    mainWindow.webContents.send('file-loading', true);
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'CIP2 Data (JSON)', extensions: ['json'] }]
    });

    if (canceled || filePaths.length === 0) {
      console.log('File selection cancelled or no file chosen.');
      mainWindow.webContents.send('file-error', 'No file selected.');
      mainWindow.webContents.send('file-loading', false);
      return;
    }

    const filePath = filePaths[0];
    currentFilePath = filePath;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.trim()) {
        console.log(`Loaded empty file: ${filePath}`);
        mainWindow.webContents.send('file-data', { filePath, data: {} });
        return;
      }
      const data = JSON.parse(content);

      // *** Start Detailed Validation ***
      const validationResult = validateCIP2DataStructure(data, filePath);
      if (validationResult.errors.length > 0) {
        const errorMessage = `Error loading file: ${validationResult.errors.join('; ')}`;
        console.error(`Validation failed for ${filePath}:`, errorMessage);
        mainWindow.webContents.send('file-error', errorMessage);
        return;
      }
      // *** End Detailed Validation ***

      console.log(`Successfully loaded and validated: ${filePath}`);
      if (validationResult.warnings.length > 0) {
          console.warn(`Validation warnings for ${filePath}:`, validationResult.warnings.join('; '));
          // Send warnings along with data
          const payload = { filePath, data, warnings: validationResult.warnings };
          console.log('[main.ts] Sending file-data with warnings:', payload);
          mainWindow.webContents.send('file-data', payload);
      } else {
          const payload = { filePath, data };
          console.log('[main.ts] Sending file-data without warnings:', payload);
          mainWindow.webContents.send('file-data', payload);
      }
    } catch (error: any) {
      console.error(`Error reading or parsing file ${filePath}:`, error);
      let errorMessage = `Error loading file: ${filePath}.`;
      if (error instanceof SyntaxError) {
        errorMessage += ' Invalid JSON format.';
      } else if (error.code === 'ENOENT') {
        errorMessage += ' File not found.';
      } else if (error.code === 'EACCES') {
        errorMessage += ' Permission denied.';
      } else {
        errorMessage += ` ${error.message || 'Unknown error'}`;
      }
      mainWindow.webContents.send('file-error', errorMessage);
    } finally {
      if (mainWindow) {
        mainWindow.webContents.send('file-loading', false);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(handleAppReady);

// --- Quit Handler ---
app.on('before-quit', async (event) => {
    console.log('App trying to quit...');
    if (forceQuit || !mainWindow) {
        console.log('Forcing quit or no window, exiting.');
        return; // Allow quit immediately
    }

    event.preventDefault(); // Prevent quitting yet

    // Ask renderer if dirty
    mainWindow.webContents.send('before-quit-request');

    // Wait for renderer response
    ipcMain.once('quit-response', async (_event, response: { isDirty: boolean }) => {
        console.log('Renderer response received:', response);
        if (!response.isDirty) {
            console.log('Not dirty, quitting normally.');
            forceQuit = true;
            app.quit();
            return;
        }

        // If dirty, show dialog
        if (!mainWindow) { // Check window again just in case
             forceQuit = true; app.quit(); return;
        }
        const { response: choice } = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Save', 'Discard', 'Cancel'],
            defaultId: 0, // Default to Save
            cancelId: 2, // Index of Cancel
            title: 'Quit Confirmation',
            message: 'You have unsaved changes. Do you want to save them before quitting?'
        });

        if (choice === 0) { // Save
            console.log('User chose Save.');
            // Ask renderer to save
             mainWindow.webContents.send('request-save');
             // Need a way to know when save is done to quit...
             // Option 1: Listen for save success/fail event from renderer
             // Option 2: Assume save happens quickly and quit after a short delay (risky)
             // Option 3: saveFile invoke could return a promise that resolves when done.
             // Let's assume for now the renderer handles save and main process can quit.
             // We rely on the renderer calling saveFile which is async.
             // Ideally, the saveFile invoke should signal completion.
             // For now, just signal quit after asking to save.
             ipcMain.once('save-file-complete', () => { // Assuming renderer sends this event
                console.log('Save complete signal received, quitting.');
                forceQuit = true;
                app.quit();
             });
             // Add a timeout in case renderer doesn't respond
             setTimeout(() => {
                if (!forceQuit) {
                    console.warn('Timeout waiting for save-file-complete, forcing quit.');
                    forceQuit = true;
                    app.quit();
                }
             }, 5000); // 5 second timeout

        } else if (choice === 1) { // Discard
            console.log('User chose Discard.');
            forceQuit = true;
            app.quit();
        } else { // Cancel (choice === 2)
            console.log('User chose Cancel.');
            // Do nothing, quit is prevented
        }
    });
});
// --- End Quit Handler ---

ipcMain.handle('save-file', async (_event, content: string) => {
  let targetPath = currentFilePath;

  if (!targetPath) {
    if (!mainWindow) {
      return { canceled: true, error: "Main window not available." };
    }
    const { canceled, filePath: newSavePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save CIP2 Data As',
      defaultPath: 'cip2-data.json',
      filters: [{ name: 'CIP2 Data (JSON)', extensions: ['json'] }]
    });
    if (canceled || !newSavePath) {
      console.log('Save As cancelled.');
      return { canceled: true };
    }
    targetPath = newSavePath;
    currentFilePath = newSavePath;
  }

  if (!targetPath) {
    console.error('Error saving: No target file path specified.');
    return { canceled: false, error: 'No target file path specified.' };
  }

  console.log(`Attempting to save data to: ${targetPath}`);
  try {
    await fs.writeFile(targetPath, content, 'utf-8');
    console.log(`Successfully saved: ${targetPath}`);
    return { canceled: false, filePath: targetPath };
  } catch (error: any) {
    console.error(`Error saving file ${targetPath}:`, error);
    const errorMessage = `Error saving file: ${targetPath}. ${error.message || 'Unknown error'}`;
    return { canceled: false, error: errorMessage };
  }
});

ipcMain.handle('export-to-word', async (_event, entries: any[]) => {
  if (!mainWindow) {
    return { canceled: true, error: 'Main window not available.' };
  }
  let outputPath: string;
  if (currentFilePath) {
    const dir = path.dirname(currentFilePath);
    const dateStr = new Date().toISOString().slice(0, 10);
    outputPath = path.join(dir, `FOI Population Programs ${dateStr}.docx`);
  } else {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save FOI Population Programs',
      defaultPath: 'FOI Population Programs.docx',
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });
    if (canceled || !filePath) {
      return { canceled: true };
    }
    outputPath = filePath;
  }
  const tmpJson = path.join(os.tmpdir(), `foi_entries_${Date.now()}.json`);
  await fs.writeFile(tmpJson, JSON.stringify(entries, null, 2), 'utf-8');
  const scriptPath = path.join(app.getAppPath(), 'make_foi_table_doc.py');
  return new Promise(resolve => {
    const args = [scriptPath, tmpJson, outputPath];
    if (currentFilePath) {
      args.push(currentFilePath);
    }
    const proc = spawn('python3', args, { stdio: 'inherit' });
    proc.on('error', (err) => resolve({ canceled: false, error: err.message }));
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve({ canceled: false, outputPath });
      } else {
        resolve({ canceled: false, error: `Python script exited with code ${code}` });
      }
    });
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) handleAppReady();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});