import React, { useState, Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import { ProgramNode } from './ProgramGraph'; // This seems wrong, should relate to FoI
import { FoiNode } from './FoIGraph'; // Correct import
import HighlightText from './HighlightText'; // Import the utility
import { Link as LinkIcon, ChevronDown, ChevronUp } from 'react-feather';
import { gsap } from 'gsap'; // Import gsap

interface FoiCardProps {
  node: FoiNode;
  parentFoiName?: string; // Keep optional if only ProgramCard needs it
  searchTerm: string; // Add searchTerm prop
  onInclusionChange: (foiName: string, included: boolean) => void; // Callback for toggle change
  isActive: boolean; // Is this card the currently active one?
  setActive: Dispatch<SetStateAction<string | null>>; // Function to set the active card ID
  onExpandRequest: (foiId: string) => void; // Add prop for requesting full expansion
  onCollapseRequest?: (foiId: string) => void; // Make optional
}

// Define dimensions for card states
const MINIMAL_WIDTH = 360; // 180 * 2
const MINIMAL_HEIGHT = 120; // 60 * 2
const PARTIAL_WIDTH = 560; // 280 * 2
const PARTIAL_HEIGHT = 360; // 180 * 2

const FoiCard: React.FC<FoiCardProps> = ({ node, searchTerm, isActive, setActive, onInclusionChange, onExpandRequest, onCollapseRequest }) => {
  const cardRef = useRef<HTMLDivElement>(null); // Ref for the inner div
  const foRef = useRef<SVGForeignObjectElement>(null); // Ref for the foreignObject

  const cardState = isActive ? 'partial' : 'minimal';
  const targetWidth = cardState === 'minimal' ? MINIMAL_WIDTH : PARTIAL_WIDTH;
  const targetHeight = cardState === 'minimal' ? MINIMAL_HEIGHT : PARTIAL_HEIGHT;
  const targetOpacity = node.data.included ? 1 : 0.6;

  // --- GSAP Animation Effect --- 
  useEffect(() => {
    if (foRef.current) {
        gsap.to(foRef.current, {
            width: targetWidth,
            height: targetHeight,
            x: -targetWidth / 2,
            y: -targetHeight / 2,
            opacity: targetOpacity,
            duration: 0.3, // PRD: ~300ms
            ease: 'power2.inOut', // PRD: ease-in-out
        });
    }
    // Animate inner div background/styles if needed, e.g., for full expansion later
    // if (cardRef.current) { ... }

  }, [targetWidth, targetHeight, targetOpacity]);
  // --- End GSAP Effect ---

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent background click
    if (cardState === 'minimal') {
      setActive(node.id); // Set this card as active
    }
    // No action needed if clicking when already partial (buttons handle actions)
  };

  // Base styles - remove transitions
  const baseDivStyle: React.CSSProperties = {
    width: '100%', // Let foreignObject control size
    height: '100%',
    backgroundColor: '#E8E4C9', // PRD Suggested Darker Beige
    borderRadius: '8px',
    padding: cardState === 'minimal' ? '8px' : '10px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    color: '#333',
    position: 'relative',
    // Opacity handled by GSAP on foreignObject
  };

  const foiNameStyle: React.CSSProperties = {
    fontSize: cardState === 'minimal' ? '20px' : '26px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: cardState === 'minimal' ? '0' : '12px',
    width: '100%',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    lineHeight: 1.3,
  };

  // Helper style for buttons (moved up)
  const iconButtonStyle: React.CSSProperties = {
      background: 'rgba(255, 255, 255, 0.6)',
      border: 'none',
      borderRadius: '50%',
      padding: '5px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
      lineHeight: 0,
  };

  // --- Button Handlers ---
  const handleContractClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent background click and card click
    setActive(null); // Collapse this card (set active to null)
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent background click and card click
    onExpandRequest(node.id); // Call the passed-in handler
    // console.log('Expand FoI clicked - Request sent');
  };
  // --- End Button Handlers ---

  // --- Toggle Handler ---
  const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // No stopPropagation needed here as it's an input change event
      onInclusionChange(node.id, e.target.checked);
  };
  // --- End Toggle Handler ---

  const cardContent = (
      <> { /* Fragment to hold multiple elements */}
          <span style={foiNameStyle}>
              <HighlightText text={node.id} highlight={searchTerm} />
          </span>
          {cardState === 'partial' && (
              <div style={{ fontSize: '18px', marginTop: 'auto', width: '100%', position: 'relative', flexGrow: 1, padding: '10px' }}>
                  {/* --- Buttons --- */}
                  <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      display: 'flex',
                      gap: '6px',
                      zIndex: 2
                  }}>
                      <button
                          onClick={handleContractClick}
                          title="Collapse"
                          style={iconButtonStyle}
                      >
                          <ChevronDown size={22} />
                      </button>
                      <button
                          onClick={handleExpandClick}
                          title="Expand"
                          style={iconButtonStyle}
                      >
                          <ChevronUp size={22} />
                      </button>
                  </div>
                  {/* --- End Buttons --- */}

                  {/* Content block - Increase top margin slightly */}
                  <div style={{ fontSize: '18px', marginTop: '45px', padding: '0 8px' }}>
                    <div>{node.data.programs.length} Programs</div>
                    <div>
                        Population: {node.data.population?.count?.toLocaleString() ?? 'N/A'}
                        {node.data.population?.as_of &&
                            <span style={{ color: 'grey' }}> (as of {node.data.population.as_of})</span>
                        }
                    </div>
                  </div>
                  
                  {/* --- Inclusion Toggle (Bottom Right) --- */}
                  <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      zIndex: 2
                   }}>
                    <span style={{ fontSize: '16px', marginRight: '8px', color: '#555' }}>Included</span>
                    <label className="toggle-switch" style={{ transform: 'scale(1.3)' }}>
                        <input
                            type="checkbox"
                            checked={node.data.included}
                            onChange={handleToggleChange}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                  </div>
                  {/* --- End Inclusion Toggle --- */}
              </div>
          )}
      </>
  );

  // Apply ref to the div created by React.createElement
  const cardDiv = React.createElement(
    'div',
    { style: baseDivStyle, xmlns: "http://www.w3.org/1999/xhtml", onClick: cardState === 'minimal' ? handleClick : undefined, ref: cardRef },
    cardContent
  );

  return (
    <foreignObject
      ref={foRef} // Add ref here
      // Initial dimensions set here, GSAP animates from these
      x={-MINIMAL_WIDTH / 2}
      y={-MINIMAL_HEIGHT / 2}
      width={MINIMAL_WIDTH}
      height={MINIMAL_HEIGHT}
      style={{ opacity: node.data.included ? 1 : 0.6 }} // Initial opacity
      onClick={(e) => e.stopPropagation()}
    >
        {cardDiv}
    </foreignObject>
  );
};

export default FoiCard;
// Re-export dimensions needed by parent FoIGraph for collision calculation
export { MINIMAL_WIDTH, MINIMAL_HEIGHT, PARTIAL_WIDTH, PARTIAL_HEIGHT }; 