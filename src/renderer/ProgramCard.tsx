import React, { useState, Dispatch, SetStateAction, useCallback, useEffect, useMemo } from 'react';
import { ProgramNode } from './ProgramGraph';
import { Link as LinkIcon, ChevronDown, ChevronUp } from 'react-feather'; // Changed icons
import { useDispatch, useSelector } from 'react-redux'; // Import useDispatch and useSelector
import { AppDispatch, ProgramData, ProgramUpdatePayload, updateProgramDetails, moveProgram, RootState, setLoading, setError, setDirty, setStatusMessage } from './store'; // Import action and types
import HighlightText from './HighlightText'; // Import utility

// Define the type for the field being edited
type EditingField = null | keyof Omit<ProgramData, 'included' | 'programs'>; // Can edit name, degree, desc, link

interface ProgramCardProps {
  node: ProgramNode;
  parentFoiName: string; // Add prop for parent FoI name
  searchTerm: string; // Add searchTerm prop
  isActive: boolean;
  isFullyExpanded: boolean; // Add prop for full expansion state
  setActive: Dispatch<SetStateAction<string | null>>;
  onInclusionChange: (programId: string, included: boolean) => void;
  onExpandRequest: (programId: string) => void; // Add prop for expand request
  onCollapseRequest: (programId: string) => void; // Add prop for collapse request
}

// Define dimensions for card states
const MINIMAL_WIDTH = 720; // 120 * 6
const MINIMAL_HEIGHT = 240; // 40 * 6
const PARTIAL_WIDTH = 1200; // 200 * 6
const PARTIAL_HEIGHT = 780; // 130 * 6
const FULL_WIDTH = 1200; // Keep width from partial for vertical feel
const FULL_HEIGHT = 1000; // Taller for editing fields

type CardState = 'minimal' | 'partial' | 'full'; // Add 'full' state

const ProgramCard: React.FC<ProgramCardProps> = React.memo(({ node, parentFoiName, searchTerm, isActive, isFullyExpanded, setActive, onInclusionChange, onExpandRequest, onCollapseRequest }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isLinkInvalid, setIsLinkInvalid] = useState<boolean>(false); // State for invalid URL

  // Select the relevant part of the state
  const presentFileData = useSelector((state: RootState) => state.app.present.fileData);

  // Memoize the derivation of FoI names
  const allFoiNames = useMemo(() => {
      console.log('[ProgramCard] Recalculating allFoiNames'); // Log when this recalculates
      return presentFileData ? Object.keys(presentFileData).sort() : [];
  }, [presentFileData]); // Only recalculate if the fileData object changes

  // Need current data state to trigger save from the present state
  const currentFileData = presentFileData; // Reuse the selected data

  const foiName = parentFoiName;

  // State for tracking if a save is needed after a move
  const [saveTriggeredByMove, setSaveTriggeredByMove] = useState(false);

  // Determine card state based on props
  const cardState: CardState = isFullyExpanded ? 'full' : isActive ? 'partial' : 'minimal';

  // Determine current dimensions based on state
  const currentWidth = cardState === 'minimal' ? MINIMAL_WIDTH : cardState === 'partial' ? PARTIAL_WIDTH : FULL_WIDTH;
  const currentHeight = cardState === 'minimal' ? MINIMAL_HEIGHT : cardState === 'partial' ? PARTIAL_HEIGHT : FULL_HEIGHT;
  const currentOpacity = node.data.included ? 1 : 0.6;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardState === 'minimal') {
      setActive(node.id); // Set this card partially active
    } else if (cardState === 'partial') {
      // Clicking partial card expands it fully
      onExpandRequest(node.id);
    }
    // Clicking full card does nothing for now (use buttons/fields)
  };

  const divStyle: React.CSSProperties = {
    width: `${currentWidth}px`,
    height: `${currentHeight}px`,
    backgroundColor: '#E8E4C9', // PRD Suggested Darker Beige (Consistent with FoI Card)
    borderRadius: '6px',
    padding: '15px', // Increased padding
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center', // Default center
    alignItems: 'center', // Default center
    cursor: cardState !== 'full' ? 'pointer' : 'default', // Only pointer if not full
    transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out, opacity 0.3s ease-in-out',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    color: '#333',
    textAlign: 'center',
    position: 'relative',
    opacity: currentOpacity,
    zIndex: cardState === 'full' ? 20 : cardState === 'partial' ? 10 : 1, // Bring expanded cards to front
  };

  const programNameStyle: React.CSSProperties = {
    fontSize: cardState === 'minimal' ? '18px' : '22px', // Significantly Increased
    fontWeight: cardState === 'minimal' ? 'normal' : 'bold',
    whiteSpace: 'normal',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    WebkitLineClamp: cardState === 'minimal' ? 3 : 4, // Allow more lines
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    width: '100%', // Ensure text respects padding
    marginBottom: cardState === 'partial' ? '15px' : '0', // Increased margin
  };

  // --- Button/Toggle Handlers ---
  const iconButtonStyle: React.CSSProperties = {
      background: 'rgba(255, 255, 255, 0.6)', // Semi-transparent background
      border: 'none',
      borderRadius: '50%', // Circular
      padding: '6px', // Increased
      cursor: 'pointer',
      color: '#333',
      lineHeight: 0,
      display: 'flex', // Center icon
      alignItems: 'center',
      justifyContent: 'center',
  };

  const handleContractClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullyExpanded) {
      // When fully expanded, clicking contract should go back to partial
      // We trigger the specific collapse *request* handler passed from the parent
      onCollapseRequest(node.id);
    } else {
      // When partially expanded, clicking contract goes to minimal
      setActive(null);
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This button should only be shown in partial state and trigger full expansion
    if (cardState === 'partial') {
        onExpandRequest(node.id);
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent card click
      // Electron securely opens external links in the default browser
      // No specific electron API needed here unless we want more control.
      window.open(node.data.link, '_blank');
  };

  const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInclusionChange(node.id, e.target.checked);
  };

  // --- Handlers for Inline Editing ---
  const handleFieldClick = (field: EditingField, currentValue: string | null | undefined) => {
    if (cardState === 'full') {
        // Reset invalid link flag when starting to edit link
        if (field === 'link') setIsLinkInvalid(false);
        setEditingField(field);
        setEditValue(currentValue ?? '');
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };

  const commitEdit = useCallback(() => {
    if (!editingField) return;

    const fieldToUpdate = editingField;
    const newValue = editValue.trim() || null;
    const currentValue = (node.data as any)[fieldToUpdate] ?? null;

    // Reset invalid flag initially
    if (fieldToUpdate === 'link') setIsLinkInvalid(false);

    setEditingField(null);

    if (newValue !== currentValue) {
        if (fieldToUpdate === 'link') {
            try {
                new URL(newValue || '');
            } catch {
                console.error("Invalid URL format, edit not committed:", newValue);
                setIsLinkInvalid(true); // Set invalid flag
                setEditingField('link'); // Keep editing open
                setEditValue(newValue || ''); // Keep invalid value in input
                return;
            }
        }

        const payload: ProgramUpdatePayload = {
            foiName,
            programId: node.id,
            // Type assertion not strictly needed here as ProgramUpdatePayload defines `field` correctly,
            // but ensure `fieldToUpdate` matches the allowed keys in ProgramUpdatePayload['field']
            field: fieldToUpdate as ProgramUpdatePayload['field'],
            value: newValue,
        };
        dispatch(updateProgramDetails(payload));
    }
  }, [dispatch, editingField, editValue, node.data, node.id, foiName]);

  const handleEditInputBlur = () => {
    commitEdit();
  };

  const handleEditInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { // Enter commits single-line inputs
        commitEdit();
    } else if (e.key === 'Escape') { // Escape cancels edit
        setEditingField(null);
    }
  };
  // --- End Inline Editing Handlers ---

  // --- Handler for Dropdown Change ---
  const handleFoiDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const targetFoiName = e.target.value;
      if (targetFoiName && targetFoiName !== foiName) {
          console.log(`Request move program ${node.id} from ${foiName} to ${targetFoiName}`);
          dispatch(moveProgram({ sourceFoiName: foiName, targetFoiName, programId: node.id }));
          // Set flag to trigger save in useEffect
          setSaveTriggeredByMove(true);
      }
  };
  // --- End Dropdown Handler ---

  // --- Effect to Trigger Save After Move ---
  // PRD 5.1: Moving a Program MUST trigger an immediate background save.
  useEffect(() => {
      if (saveTriggeredByMove && currentFileData) {
          const saveData = async () => {
              console.log('Auto-saving due to program move...');
              const contentToSave = JSON.stringify(currentFileData, null, 2);
              dispatch(setLoading(true));
              dispatch(setError(null));
              try {
                  // We don't know the current file path here directly, call saveFile
                  const result = await window.electronAPI.saveFile(contentToSave);
                  if (result.error) {
                      dispatch(setError(`Auto-save failed: ${result.error}`));
                  } else {
                      console.log('Auto-save successful.');
                      // Successful save should reset dirty state - need reducer for this?
                      // For now, assume save success implies data is no longer dirty *from this action*
                      // dispatch(setDirty(false)); // This might be too broad
                  }
              } catch (err: any) {
                  dispatch(setError(`Auto-save failed: ${err.message || 'Unknown error'}`));
              } finally {
                  dispatch(setLoading(false));
              }
          };
          saveData();
          setSaveTriggeredByMove(false); // Reset flag
      }
  }, [saveTriggeredByMove, currentFileData, dispatch]);
  // --- End Save Trigger Effect ---

  const cardContent = (
      <>
        {/* Program Name */} 
        <span
            style={programNameStyle}
            onClick={cardState !== 'full' ? handleClick : undefined}
        >
            <HighlightText text={node.data.name} highlight={searchTerm} />
        </span>

        {/* Controls & Toggle (only in partial state) */} 
        {cardState === 'partial' && (
           <div style={{ width: '100%', position: 'relative', flexGrow: 1, marginTop: '8px' /* Increased space below name */ }}>
                {/* Buttons Top-Left */}
                <div style={{
                    position: 'absolute', top: '5px', left: '5px',
                    display: 'flex', gap: '8px', /* Increased */ zIndex: 2
                }}>
                    {/* Contract Button (Down) */}
                    <button onClick={handleContractClick} title="Collapse" style={iconButtonStyle}><ChevronDown size={24} /* Increased */ /></button>
                    {/* Expand Button (Up) */}
                    <button onClick={handleExpandClick} title="Expand Program Details" style={iconButtonStyle}><ChevronUp size={24} /* Increased */ /></button>
                    {/* Link Button */} 
                    <button onClick={handleLinkClick} title="Open Program Link" style={iconButtonStyle}><LinkIcon size={24} /* Increased */ /></button>
                </div>

                {/* Toggle Bottom-Right */}
                <div style={{
                    position: 'absolute', bottom: '5px', right: '5px',
                    display: 'flex', alignItems: 'center', zIndex: 2
                 }}>
                    <span style={{ fontSize: '16px', /* Increased */ marginRight: '8px', color: '#555' }}>Included</span>
                    <label className="toggle-switch" style={{ transform: 'scale(1.5)' /* Scale toggle */ }}>
                        <input
                            type="checkbox"
                            checked={node.data.included}
                            onChange={handleToggleChange}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
            </div>
        )}

        {/* Full Expansion Content */}
        {cardState === 'full' && (
            <div style={fullContentStyle}>
                {/* Degree */}
                <div style={fieldRowStyle}>
                    <label style={fieldLabelStyle}>Degree:</label>
                    {editingField === 'degree' ? (
                        <input
                            type="text"
                            value={editValue}
                            onChange={handleEditInputChange}
                            onBlur={handleEditInputBlur}
                            onKeyDown={handleEditInputKeyDown}
                            style={{...inlineInputStyle, flexGrow: 1}} // Allow input to grow
                            autoFocus
                        />
                    ) : (
                        <span style={fieldValueStyle} onClick={() => handleFieldClick('degree', node.data.degree)} title="Click to edit degree">
                            {node.data.degree || <i style={{color: '#999'}}>None</i>}
                        </span>
                    )}
                </div>

                {/* Description - Highlight if not editing */}
                <div style={{...fieldRowStyle, alignItems: 'flex-start' }}>
                    <label style={fieldLabelStyle}>Desc:</label>
                    {editingField === 'description' ? (
                        <textarea
                            value={editValue}
                            onChange={handleEditInputChange}
                            onBlur={handleEditInputBlur}
                            onKeyDown={handleEditInputKeyDown} // Escape works, Enter adds newline
                            style={inlineTextAreaStyle}
                            rows={3} // Start with a few rows
                            autoFocus
                        />
                    ) : (
                        <span style={{...fieldValueStyle, whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto'}} onClick={() => handleFieldClick('description', node.data.description)} title="Click to edit description">
                             <HighlightText text={node.data.description || ''} highlight={searchTerm} />
                             {!node.data.description && <i style={{color: '#999'}}>None</i>}
                        </span>
                    )}
                </div>

                 {/* Link */}
                 <div style={fieldRowStyle}>
                    <label style={fieldLabelStyle}>Link:</label>
                    {editingField === 'link' ? (
                        <input
                            type="url" // Use URL type for basic browser validation hint
                            value={editValue}
                            onChange={handleEditInputChange}
                            onBlur={handleEditInputBlur} // Validation happens on commit
                            onKeyDown={handleEditInputKeyDown}
                            style={{
                                ...inlineInputStyle,
                                flexGrow: 1,
                                borderColor: isLinkInvalid ? 'red' : '#aaa', // Apply red border if invalid
                            }}
                            autoFocus
                        />
                    ) : (
                        <span style={{...fieldValueStyle, wordBreak: 'break-all'}} onClick={() => handleFieldClick('link', node.data.link)} title="Click to edit link">
                             {node.data.link}
                        </span>
                    )}
                </div>

                {/* Parent FoI Dropdown */}
                <div style={fieldRowStyle}>
                    <label style={fieldLabelStyle} htmlFor={`foi-select-${node.id}`}>FoI:</label>
                    <select
                        id={`foi-select-${node.id}`}
                        value={foiName} // Current parent FoI
                        onChange={handleFoiDropdownChange}
                        style={selectStyle}
                        title="Change Field of Interest"
                    >
                        {allFoiNames.map(name => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        )}
      </>
  );

  const cardDiv = React.createElement(
    'div',
    { style: divStyle, xmlns: "http://www.w3.org/1999/xhtml", onClick: handleClick },
    cardContent
  );

  return (
    <foreignObject
      x={-currentWidth / 2}
      y={-currentHeight / 2}
      width={currentWidth}
      height={currentHeight}
      style={{ opacity: currentOpacity, transition: 'opacity 0.3s ease-in-out' }}
      onClick={(e) => e.stopPropagation()} // Stop propagation on foreignObject too
    >
      {cardDiv}
    </foreignObject>
  );
});

// --- Styles --- (Can be moved to a separate file later)
const controlContainerStyle: React.CSSProperties = {
    position: 'absolute', top: '3px', left: '3px',
    display: 'flex', gap: '3px',
};
const toggleContainerStyle: React.CSSProperties = {
    marginTop: 'auto', // Push to bottom
    paddingTop: '4px',
};
const inlineInputStyle: React.CSSProperties = {
    padding: '6px', // Increased
    border: '1px solid #aaa',
    borderRadius: '3px',
    fontSize: '16px', // Increased font size
    boxSizing: 'border-box',
    marginLeft: '5px',
};
const inlineTextAreaStyle: React.CSSProperties = {
    ...inlineInputStyle,
    resize: 'vertical', // Allow vertical resize
    minHeight: '60px', // Increased min height
    fontFamily: 'inherit', // Match surrounding font
    flexGrow: 1, // Allow textarea to grow
};
const fullContentStyle: React.CSSProperties = {
    marginTop: '15px', // Increased
    width: '100%',
    borderTop: '1px solid #ccc',
    paddingTop: '15px', // Increased
    fontSize: '16px', // Base font size increased
    textAlign: 'left',
    display: 'flex', // Use flex for layout
    flexDirection: 'column',
    gap: '12px', // Increased gap between fields
};
const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center', // Align label and value/input vertically
    width: '100%',
};
const fieldLabelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginRight: '8px', // Increased
    flexShrink: 0, // Prevent label from shrinking
    width: '60px', // Increased width for alignment
    textAlign: 'right',
    fontSize: '16px', // Increased
};
const fieldValueStyle: React.CSSProperties = {
    flexGrow: 1, // Allow value to take remaining space
    cursor: 'pointer', // Indicate clickable
    padding: '6px', // Match input padding roughly
    border: '1px solid transparent', // Placeholder for alignment
    borderRadius: '3px',
    minHeight: '30px', // Ensure minimum height matching input (Increased)
    boxSizing: 'border-box',
    marginLeft: '5px',
    fontSize: '16px', // Increased
};
const selectStyle: React.CSSProperties = {
    ...inlineInputStyle, // Base styling like input
    flexGrow: 1,
    padding: '6px', // Adjust padding if needed
    cursor: 'pointer',
};
// --- End Styles ---

export default ProgramCard;
export { MINIMAL_WIDTH, MINIMAL_HEIGHT, PARTIAL_WIDTH, PARTIAL_HEIGHT, FULL_WIDTH, FULL_HEIGHT }; // Export dimensions 