import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Save, Search, RotateCcw, RotateCw } from 'react-feather';
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { RootState, AppDispatch, setLoading, setError, setFilePath, setFileData, setStatusMessage } from './store';
import FoIGraph from './FoIGraph'; // Import the new graph component
import ExpandedFoiView from './ExpandedFoiView'; // Import the new view
// TODO: Re-integrate or move validation logic (validateCIP2Data)
// import { validateCIP2Data } from './validate';

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Select state from the 'present' slice of the undoable state
  const presentState = useSelector((state: RootState) => state.app.present);
  const { filePath, fileData, isLoading, error, statusMessage } = presentState;
  // Select undo/redo history
  const canUndo = useSelector((state: RootState) => state.app.past.length > 0);
  const canRedo = useSelector((state: RootState) => state.app.future.length > 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [fullyExpandedFoiId, setFullyExpandedFoiId] = useState<string | null>(null); // State for full expansion
  const [warnings, setWarnings] = useState<string[]>([]); // State for load warnings

  // Log the fileData from state on every render
  console.log('[App.tsx] Rendering - fileData from store:', fileData);

  // --- Save Handler (moved up) ---
  const handleSave = useCallback(async () => {
    if (!fileData || !filePath) {
        console.warn("Save attempted but no file data or path is loaded.");
        dispatch(setError("Cannot save: No file loaded."));
        return;
    }
    if (!canUndo) {
        console.log("No changes to save.");
        dispatch(setStatusMessage('No changes to save.')); // Give feedback
        setTimeout(() => dispatch(setStatusMessage(null)), 3000);
        return;
    }

    const contentToSave = JSON.stringify(fileData, null, 2);
    dispatch(setLoading(true));
    dispatch(setError(null));
    dispatch(setStatusMessage('Saving...')); // Set status

    try {
        const result = await window.electronAPI.saveFile(contentToSave);

        if (result.canceled) {
            dispatch(setStatusMessage('Save cancelled.'));
        } else if (result.error) {
            dispatch(setError(`Save failed: ${result.error}`));
            dispatch(setStatusMessage(null)); // Clear status on error
        } else {
            if (result.filePath && result.filePath !== filePath) {
                 dispatch(setFilePath(result.filePath));
            }
            dispatch(UndoActionCreators.clearHistory());
            dispatch(setStatusMessage('Save successful.'));
            console.log(`File saved successfully to: ${result.filePath}`);
        }
    } catch (err: any) {
        dispatch(setError(`Save failed: ${err.message || 'Unknown error'}`));
        dispatch(setStatusMessage(null));
    } finally {
        dispatch(setLoading(false));
        setTimeout(() => dispatch(setStatusMessage(null)), 3000);
    }
  }, [dispatch, fileData, filePath, canUndo]);

  // --- Handlers for Full Expansion (moved up) ---
  const handleExpandFoi = (foiId: string) => {
      setFullyExpandedFoiId(foiId);
      setSearchTerm('');
  };

  const handleCollapseFoi = () => {
      setFullyExpandedFoiId(null);
      setSearchTerm('');
  };
  // --- End Handlers ---

  // --- IPC Listeners Effect ---
  useEffect(() => {
    // Listener for loading state changes
    const removeLoadingListener = window.electronAPI.onFileLoading((loading) => {
      dispatch(setLoading(loading));
    });

    // Listener for successfully loaded file data
    const removeDataListener = window.electronAPI.onFileData((result) => {
      console.log('[App.tsx] onFileData listener fired with result:', result);
      // Store and display warnings
      if (result.warnings && result.warnings.length > 0) {
          console.warn('Load Warnings:', result.warnings);
          setWarnings(result.warnings);
      } else {
          setWarnings([]); // Clear previous warnings
      }
      // Dispatch actions
      console.log('[App.tsx] Dispatching setFilePath and setFileData...');
      dispatch(setFilePath(result.filePath));
      dispatch(setFileData(result.data));
      dispatch(UndoActionCreators.clearHistory());
      dispatch(setError(null));
    });

    // Listener for file loading errors
    const removeErrorListener = window.electronAPI.onFileError((errMsg) => {
      dispatch(setError(errMsg));
      dispatch(setFileData(null));
    });

    // Listener for quit request from main process
    const removeQuitRequestListener = window.electronAPI.onBeforeQuitRequest(() => {
      console.log('Received before-quit-request, checking dirty state (using canUndo)...');
      window.electronAPI.sendQuitResponse({ isDirty: canUndo });
    });

    // Listener for save request from main process (during quit sequence)
    const removeSaveRequestListener = window.electronAPI.onRequestSave(async () => {
        console.log('Received request-save from main process.');
        try {
            if (canUndo) {
                await handleSave();
            } else {
                console.log('Save requested, but not dirty (canUndo=false). Ignoring.');
            }
        } finally {
             console.log('Sending save-file-complete signal.');
             window.electronAPI.sendSaveComplete();
        }
    });

    // Cleanup all listeners
    return () => {
      removeQuitRequestListener();
      removeSaveRequestListener();
      removeLoadingListener();
      removeDataListener();
      removeErrorListener();
    };
  }, [dispatch, canUndo, handleSave]);

  // --- Keyboard Shortcuts Effect ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        // Undo: Cmd+Z or Ctrl+Z
        if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (canUndo) {
                console.log('Dispatching Undo');
                dispatch(UndoActionCreators.undo());
            }
        }
        // Redo: Cmd+Shift+Z or Ctrl+Y
        else if (((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') || (event.ctrlKey && event.key === 'y')) {
            event.preventDefault();
            if (canRedo) {
                console.log('Dispatching Redo');
                dispatch(UndoActionCreators.redo());
            }
        }
        // Save: Cmd+S or Ctrl+S
        else if ((event.metaKey || event.ctrlKey) && event.key === 's') {
            event.preventDefault();
            if (canUndo && !isLoading) {
                console.log('Triggering Save via shortcut');
                handleSave();
            }
        }
        // Escape Key Logic
        else if (event.key === 'Escape') {
            console.log('Escape key pressed');
            event.preventDefault();
            if (fullyExpandedFoiId) {
                console.log('Collapsing FoI view via Esc');
                handleCollapseFoi();
            } else {
                 console.log('Esc pressed - Card collapse logic needed here or passed down.');
                 window.dispatchEvent(new CustomEvent('escPressed'));
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, canUndo, canRedo, isLoading, handleSave, fullyExpandedFoiId, handleCollapseFoi]);

  // --- Undo/Redo Handlers ---
  const handleUndo = useCallback(() => {
    if (canUndo) {
        dispatch(UndoActionCreators.undo());
    }
  }, [dispatch, canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
        dispatch(UndoActionCreators.redo());
    }
  }, [dispatch, canRedo]);
  // --- End Undo/Redo Handlers ---

  // --- Search Handler ---
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setSearchTerm(e.target.value);
  };

  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#F5F5DC', // PRD: Very light beige
        backgroundImage: 'radial-gradient(#D3D3D3 0.5px, transparent 0.5px)', // PRD: Subtle gray dots
        backgroundSize: '15px 15px', // Size of the repeating dot pattern
    }}>
      {/* --- Top Bar --- */}
      {/* PRD 5.2: Controls (Top Floating Bar) */}
      <div style={{
          padding: '8px 15px',
          borderBottom: '1px solid #ccc',
          background: 'rgba(245, 245, 220, 0.85)', // Light beige with some transparency
          backdropFilter: 'blur(5px)', // Optional blur effect for float feel
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          position: 'sticky', // Make it sticky
          top: 0,
          zIndex: 10, // Ensure it floats above graph
      }}>
         {/* Left Aligned Area - Show Status Message */}
         <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            {statusMessage && (
                <span style={{
                    color: error ? 'red' : (statusMessage.includes('successful') ? 'green' : '#333'),
                    fontWeight: error ? 'bold' : 'normal',
                }}>
                    {statusMessage}
                </span>
            )}
            {!statusMessage && isLoading && <span style={{ color: '#555' }}>Loading...</span>}
            {!statusMessage && !isLoading && error && <span style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</span>}
            {!statusMessage && !isLoading && filePath && (
                <span style={{ color: '#666', fontSize: '0.9em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {filePath}
                </span>
            )}
            {/* Display Warnings if present (and no error) */}
            {!error && warnings.length > 0 && (
               <span style={{ color: 'orange', fontStyle: 'italic' }} title={warnings.join('\n')}>
                   [!] {warnings.length} Load Warning(s)
               </span>
            )}
         </div>

         {/* Right Aligned: Buttons & Search */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Redo Button */}
            <button onClick={handleRedo} title="Redo (Cmd+Shift+Z)" disabled={!canRedo} style={iconButtonStyle(canRedo)}>
                <RotateCw size={18} />
            </button>
            {/* Undo Button */}
            <button onClick={handleUndo} title="Undo (Cmd+Z)" disabled={!canUndo} style={iconButtonStyle(canUndo)}>
                <RotateCcw size={18} />
            </button>
            {/* Search Bar - TODO: Update placeholder based on view */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '8px', color: '#777' }} />
                <input
                    type="text"
                    placeholder={fullyExpandedFoiId ? `Search Programs in ${fullyExpandedFoiId}...` : "Search Fields of Interest..."} // Contextual placeholder
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={searchInputStyle}
                />
            </div>
            {/* Save Button */}
            <button onClick={handleSave} title="Save Changes (Cmd+S)" disabled={!canUndo || isLoading} style={saveButtonStyle(canUndo && !isLoading)}>
                <Save size={18} style={{ marginRight: '5px' }} /> Save
            </button>
         </div>
      </div>
      {/* --- End Top Bar --- */}

      {/* --- Main Content Area --- */}
      <div style={{ ...mainAreaBaseStyle, ...dotGridBackground }}>
          {fullyExpandedFoiId && fileData?.[fullyExpandedFoiId] ? (
              // Render Fully Expanded FoI View
              <ExpandedFoiView
                foiId={fullyExpandedFoiId}
                onCollapse={handleCollapseFoi}
                searchTerm={searchTerm}
              />
          ) : fileData ? (
              // Render FoI Graph View
              <FoIGraph searchTerm={searchTerm} onExpandClick={handleExpandFoi} />
          ) : (
              // Render Loading/No Data messages
              <div style={{ padding: '20px', textAlign: 'center' }}>
                  {!isLoading && !error && <div>No data loaded. Waiting for file selection...</div>}
              </div>
          )}
      </div>
      {/* --- End Main Content Area --- */}
    </div>
  );
};

// --- Styles --- (moved outside component for clarity)
const iconButtonStyle = (isActive: boolean): React.CSSProperties => ({
    background: 'none',
    border: '1px solid transparent', // No border by default
    padding: '5px',
    borderRadius: '4px',
    cursor: isActive ? 'pointer' : 'default',
    color: isActive ? '#333' : '#aaa', // Dim if disabled
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s, border-color 0.2s',
    // ':hover': isActive ? { // Cannot use pseudo-classes in inline styles directly
    //     backgroundColor: 'rgba(0, 0, 0, 0.05)',
    //     borderColor: '#ccc',
    // } : undefined,
    // ':disabled': { // Handled by browser default/opacity below
    //     cursor: 'not-allowed',
    //     opacity: 0.5,
    // }
    // Opacity is handled implicitly by the disabled attribute on the button element
});

const saveButtonStyle = (isActive: boolean): React.CSSProperties => ({
    ...iconButtonStyle(isActive),
    padding: '5px 10px',
    fontWeight: 500,
});

const searchInputStyle: React.CSSProperties = {
    padding: '5px 10px 5px 30px', // Left padding for icon
    border: '1px solid #ccc',
    borderRadius: '15px',
    fontSize: '13px',
    minWidth: '200px',
    outline: 'none',
};

const mainAreaBaseStyle: React.CSSProperties = {
    flexGrow: 1,
    padding: '0',
    position: 'relative', // Needed for potential absolute positioning inside
};

// PRD 5.2: Faint, uniform grid of subtle gray dots
const dotGridBackground: React.CSSProperties = {
    backgroundColor: '#FAF8F0', // Paler graph background
    backgroundImage: 'radial-gradient(#E0E0E0 1px, transparent 1px)', // Slightly less prominent dots
    backgroundSize: '18px 18px', // Slightly larger grid
};

export default App;