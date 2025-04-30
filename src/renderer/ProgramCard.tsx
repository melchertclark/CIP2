import React, { useState, Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react';
import { ProgramNode } from './ProgramGraph';
import { Link as LinkIcon, ChevronDown, ChevronUp } from 'react-feather'; // Changed icons
import { useDispatch, useSelector } from 'react-redux'; // Import useDispatch and useSelector
import { AppDispatch, ProgramData, ProgramUpdatePayload, updateProgramDetails, moveProgram, RootState, setLoading, setError, setStatusMessage } from './store'; // Import action and types - removed setDirty
import { ActionCreators as UndoActionCreators } from 'redux-undo'; // Import undo actions
import { gsap } from 'gsap'; // Import gsap
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

// Original dimensions
const MINIMAL_WIDTH = 720;
const MINIMAL_HEIGHT = 240;
const PARTIAL_WIDTH = 1200;
const PARTIAL_HEIGHT = 780;
const FULL_WIDTH = 1200;
const FULL_HEIGHT = 1000;

type CardState = 'minimal' | 'partial' | 'full'; // Add 'full' state

const ProgramCard: React.FC<ProgramCardProps> = React.memo(({ node, parentFoiName, searchTerm, isActive, isFullyExpanded, setActive, onInclusionChange, onExpandRequest, onCollapseRequest }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isLinkInvalid, setIsLinkInvalid] = useState<boolean>(false); // State for invalid URL
  const [focusedField, setFocusedField] = useState<EditingField>(null); // Track focus for styling
  const cardRef = useRef<HTMLDivElement>(null); // Ref for the inner div
  const foRef = useRef<SVGForeignObjectElement>(null); // Ref for the foreignObject

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

  // --- GSAP Animation Effect --- 
  useEffect(() => {
    if (foRef.current) {
        gsap.to(foRef.current, {
            width: currentWidth,
            height: currentHeight,
            x: -currentWidth / 2,
            y: -currentHeight / 2,
            opacity: currentOpacity,
            duration: 0.3, // PRD: ~300ms
            ease: 'power2.inOut', // PRD: ease-in-out
        });
    }
    // Animate inner div background/styles if needed
    // if (cardRef.current) { ... }

  }, [currentWidth, currentHeight, currentOpacity]);
  // --- End GSAP Effect ---

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
    // width: `${currentWidth}px`, // Controlled by GSAP on foreignObject
    // height: `${currentHeight}px`, // Controlled by GSAP on foreignObject
    width: '100%', // Let foreignObject control size
    height: '100%', // Let foreignObject control size
    backgroundColor: '#E8E4C9', // PRD Suggested Darker Beige (Consistent with FoI Card)
    borderRadius: '6px',
    padding: '40px', // Padding for 4x size
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center', // Default center
    alignItems: 'center', // Default center
    cursor: cardState !== 'full' ? 'pointer' : 'default', // Only pointer if not full
    // transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out, opacity 0.3s ease-in-out', // Remove CSS transition, GSAP handles it
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    color: '#333',
    textAlign: 'center',
    position: 'relative',
    // opacity: currentOpacity, // Controlled by GSAP on foreignObject
    zIndex: cardState === 'full' ? 20 : cardState === 'partial' ? 10 : 1, // Bring expanded cards to front
  };

  const programNameStyle: React.CSSProperties = {
    // fontSize: cardState === 'minimal' ? '22px' : '30px', // Font size for original large size
    fontSize: cardState === 'minimal' ? '48px' : '72px', // Font size for 4x size
    fontWeight: cardState === 'minimal' ? 'normal' : 'bold',
    whiteSpace: 'normal',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    WebkitLineClamp: cardState === 'minimal' ? 3 : 4, // Keep line clamp same for now
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    width: '100%', 
    // marginBottom: cardState === 'partial' ? '18px' : '0', // Margin for original large size
    marginBottom: cardState === 'partial' ? '36px' : '0', // Margin for 4x size
  };

  // --- Button/Toggle Handlers ---
  const iconButtonStyle: React.CSSProperties = {
      background: 'rgba(255, 255, 255, 0.6)', // Semi-transparent background
      border: 'none',
      borderRadius: '50%', // Circular
      padding: '16px', // Padding for 4x size
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
        if (field === 'link') setIsLinkInvalid(false);
        setEditingField(field);
        setEditValue(currentValue ?? '');
        setFocusedField(field); // Set focus state
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
    setFocusedField(null); // Clear focus state on blur
  };

  const handleEditInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { // Enter commits single-line inputs
        commitEdit();
        setFocusedField(null); // Clear focus on commit
    } else if (e.key === 'Escape') { // Escape cancels edit
        setEditingField(null);
        setFocusedField(null); // Clear focus on cancel
        setIsLinkInvalid(false); // Also clear invalid link flag on escape
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
              dispatch(setLoading(true)); // Show loading during save
              dispatch(setStatusMessage('Auto-saving...'));
              const contentToSave = JSON.stringify(currentFileData, null, 2);
              dispatch(setError(null)); // Clear previous errors
              try {
                  // We don't know the current file path here directly, call saveFile
                  // Note: saveFile in main might update the path if it was null
                  const result = await window.electronAPI.saveFile(contentToSave);
                  if (result.error) {
                      dispatch(setError(`Auto-save failed: ${result.error}`));
                      dispatch(setStatusMessage(null));
                  } else {
                      console.log('Auto-save successful.');
                      dispatch(setStatusMessage('Auto-save successful.'));
                      // Successful save should reset dirty state.
                      dispatch(UndoActionCreators.clearHistory()); // Clear history after successful save
                      // If saveFile returned a new path, App.tsx's handleSave logic would handle it.
                      // We don't need to dispatch setFilePath here.
                  }
              } catch (err: any) {
                dispatch(setError(`Auto-save failed: ${err.message || 'Unknown error'}`));
                dispatch(setStatusMessage(null));
              } finally {
                  dispatch(setLoading(false)); // Hide loading
                  setSaveTriggeredByMove(false); // Reset the trigger flag
                  // Clear status message after a delay
                  setTimeout(() => dispatch(setStatusMessage(null)), 3000);
              }
          };
          saveData();
      }
  }, [saveTriggeredByMove, currentFileData, dispatch]); // Dependencies

  // --- JSX Content Rendering ---
  // Define content for each state
  const minimalContent = (
      <div style={programNameStyle}>
          <HighlightText text={node.data.name} highlight={searchTerm} />
      </div>
  );

  const partialContent = (
    <>
        <div style={programNameStyle}>
          <HighlightText text={node.data.name} highlight={searchTerm} />
        </div>
        {/* Show degree only if it exists */}
        {node.data.degree && (
          // <div style={{ fontSize: '22px', fontStyle: 'italic', color: '#555', marginBottom: '15px' }}> {/* Font size for original large size */} 
          <div style={{ fontSize: '40px', fontStyle: 'italic', color: '#555', marginBottom: '30px' }}> {/* Font size for 4x size */} 
            <HighlightText text={node.data.degree} highlight={searchTerm} />
          </div>
        )}
        <div style={{
            // fontSize: '20px', // Font size for original large size
            fontSize: '40px', // Font size for 4x size
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            // maxHeight: '350px', // Height limit for original large size
            maxHeight: '700px', // Height limit for 4x size
            display: '-webkit-box',
            // WebkitLineClamp: 12, // Line limit for original large size
            WebkitLineClamp: 15, // Line limit for 4x size
            WebkitBoxOrient: 'vertical',
            color: '#444', 
            marginTop: 'auto', 
            // marginBottom: '20px', // Space for original large size
            marginBottom: '40px', // Space for 4x size
            // padding: '0 12px', // Padding for original large size
            padding: '0 24px', // Padding for 4x size
        }}>
          <HighlightText text={node.data.description ?? ''} highlight={searchTerm} />
        </div>
    </>
);


const fullContent = (
    // <div style={{...fullContentStyle, fontSize: '22px'}}> {/* Base font size for original large size */} 
    <div style={{...fullContentStyle, fontSize: '44px'}}> {/* Base font size for 4x size */} 
        {/* Program Name (Included in main div, not repeated here) */}

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
                    onFocus={() => setFocusedField('degree')} // Set focus state
                    style={{
                        ...inlineInputStyleBase,
                        flexGrow: 1,
                        // Subtle background change on focus
                        backgroundColor: focusedField === 'degree' ? '#F8F8F0' : inlineInputStyleBase.backgroundColor,
                    }}
                    autoFocus
                />
            ) : (
                <span style={fieldValueStyle} onClick={() => handleFieldClick('degree', node.data.degree)} title="Click to edit degree">
                    {node.data.degree || <i style={{color: '#999'}}>None</i>}
                </span>
            )}
        </div>

        {/* Description */}
        <div style={{...fieldRowStyle, alignItems: 'flex-start' }}>
            <label style={fieldLabelStyle}>Desc:</label>
            {editingField === 'description' ? (
                <textarea
                    value={editValue}
                    onChange={handleEditInputChange}
                    onBlur={handleEditInputBlur}
                    onKeyDown={handleEditInputKeyDown}
                    onFocus={() => setFocusedField('description')} // Set focus state
                    style={inlineTextAreaStyleBase}
                    rows={5} // Increased rows
                    autoFocus
                />
            ) : (
                <span style={{...fieldValueStyle, whiteSpace: 'pre-wrap', overflowY: 'auto'}} onClick={() => handleFieldClick('description', node.data.description)} title="Click to edit description">
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
                    type="url"
                    value={editValue}
                    onChange={handleEditInputChange}
                    onBlur={handleEditInputBlur}
                    onKeyDown={handleEditInputKeyDown}
                    onFocus={() => setFocusedField('link')} // Set focus state
                    style={{
                        ...inlineInputStyleBase,
                        flexGrow: 1,
                        // Subtle background change on focus, but red border takes priority if invalid
                        backgroundColor: focusedField === 'link' && !isLinkInvalid ? '#F8F8F0' : inlineInputStyleBase.backgroundColor,
                        borderColor: isLinkInvalid ? 'red' : (focusedField === 'link' ? '#888' : inlineInputStyleBase.borderColor), // Slightly darker border on focus if not invalid
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
                value={foiName}
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
);
  // END of content definitions

  return (
    <foreignObject
      ref={foRef} 
      x={-MINIMAL_WIDTH / 2} 
      y={-MINIMAL_HEIGHT / 2}
      width={MINIMAL_WIDTH}
      height={MINIMAL_HEIGHT}
      style={{ opacity: node.data.included ? 1 : 0.6 }} 
      onClick={(e) => e.stopPropagation()} 
    >
      <div style={divStyle} onClick={handleClick} ref={cardRef}>
        {/* Render the specific content based on state */}
        {cardState === 'minimal' && minimalContent}
        {cardState === 'partial' && partialContent}
        {cardState === 'full' && fullContent}

        {/* Buttons & Toggle remain common for partial/full states */}
        {(cardState === 'partial' || cardState === 'full') && (
            <>
                {/* --- Top Left Buttons (Contract/Expand) --- */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '16px', zIndex: 5 }}> 
                    <button onClick={handleContractClick} title={cardState === 'full' ? "Collapse to Partial" : "Collapse to Minimal"} style={iconButtonStyle}>
                        <ChevronDown size={48} /> 
                    </button>
                    {cardState === 'partial' && (
                        <button onClick={handleExpandClick} title="Expand to Full" style={iconButtonStyle}>
                            <ChevronUp size={48} /> 
                        </button>
                    )}
                </div>
                {/* --- Top Right Link --- */}
                <button onClick={handleLinkClick} title="Open Program Link" style={{ ...iconButtonStyle, position: 'absolute', top: '20px', right: '20px', zIndex: 5 }}> 
                    <LinkIcon size={48} /> 
                </button>
                {/* --- Bottom Right Toggle --- */}
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', alignItems: 'center', zIndex: 5 }}> 
                    {/* <span style={{ fontSize: '36px', marginRight: '20px', color: '#555' }}>Included</span> */} 
                    <span style={{ fontSize: '32px', marginRight: '15px', color: '#555' }}>Included</span> {/* Adjusted font size/margin */} 
                    {/* <label className="toggle-switch" style={{ transform: 'scale(2.5)' }}> */} 
                    <label className="toggle-switch" style={{ transform: 'scale(2.0)' }}> {/* Adjusted scale */} 
                        <input
                            type="checkbox"
                            checked={node.data.included}
                            onChange={handleToggleChange}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
            </>
        )}
      </div>
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
const inlineInputStyleBase: React.CSSProperties = {
    // padding: '10px', // Padding for original large size
    padding: '20px', // Padding for 4x size
    border: '1px solid #aaa',
    borderRadius: '3px',
    fontSize: 'inherit', // Inherit from fullContentStyle (now 44px)
    boxSizing: 'border-box',
    backgroundColor: '#FFF',
    outline: 'none',
};
const inlineTextAreaStyleBase: React.CSSProperties = {
    ...inlineInputStyleBase,
    resize: 'vertical',
    // minHeight: '150px', // Min height for original large size
    minHeight: '300px', // Min height for 4x size
    fontFamily: 'inherit',
    flexGrow: 1,
};
const fullContentStyle: React.CSSProperties = {
    // marginTop: '20px', // Margin for original large size
    marginTop: '40px', // Margin for 4x size
    width: '100%',
    borderTop: '1px solid #ccc',
    // paddingTop: '20px', // Padding for original large size
    paddingTop: '40px', // Padding for 4x size
    textAlign: 'left',
    display: 'flex', 
    flexDirection: 'column',
    // gap: '16px', // Gap for original large size
    gap: '32px', // Gap for 4x size
};
const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center', 
    width: '100%',
};
const fieldLabelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    // marginRight: '15px', // Margin for original large size
    marginRight: '30px', // Margin for 4x size
    flexShrink: 0, 
    // width: '150px', // Width for original large size
    width: '300px', // Width for 4x size
    textAlign: 'right',
    fontSize: 'inherit', 
};
const fieldValueStyle: React.CSSProperties = {
    flexGrow: 1, 
    cursor: 'pointer', 
    // padding: '10px 12px', // Padding for original large size
    padding: '20px 24px', // Padding for 4x size
    borderRadius: '3px',
    // minHeight: '36px', // Min height for original large size
    minHeight: '72px', // Min height for 4x size
    fontSize: 'inherit', 
    backgroundColor: 'transparent', 
    transition: 'background-color 0.2s ease',
};
const selectStyle: React.CSSProperties = {
    ...inlineInputStyleBase,
    flexGrow: 1,
    padding: '20px', // Padding for 4x size
    cursor: 'pointer',
    // Add macOS-like styling
    appearance: 'none', 
    WebkitAppearance: 'none', 
    MozAppearance: 'none', 
    backgroundColor: '#F5F5F5', 
    backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%23888888" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>')`, 
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 15px center', 
    backgroundSize: '20px', 
    border: '1px solid #CCCCCC', 
    borderRadius: '5px', 
    paddingRight: '45px', 
    fontSize: '20px', // Override inherited large font size
};
// --- End Styles ---

export default ProgramCard;
export { MINIMAL_WIDTH, MINIMAL_HEIGHT, PARTIAL_WIDTH, PARTIAL_HEIGHT, FULL_WIDTH, FULL_HEIGHT }; // Export dimensions 