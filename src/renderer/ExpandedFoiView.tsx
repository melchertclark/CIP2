import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { XCircle } from 'react-feather'; // Icon for collapse button
import ProgramGraph from './ProgramGraph'; // Import ProgramGraph

interface ExpandedFoiViewProps {
  foiId: string;
  onCollapse: () => void;
  searchTerm: string; // To be passed to ProgramGraph later
}

const ExpandedFoiView: React.FC<ExpandedFoiViewProps> = ({ foiId, onCollapse, searchTerm }) => {
  const foiData = useSelector((state: RootState) => state.app.present.fileData?.[foiId]);

  if (!foiData) {
    // Handle case where data might not be found (e.g., file changed)
    return (
      <div style={styles.container}>
        <p>Error: Field of Interest "{foiId}" not found.</p>
        <button onClick={onCollapse} style={styles.collapseButton} title="Collapse Field of Interest View">
            <XCircle size={24} />
        </button>
      </div>
    );
  }

  // PRD 5.3: Background: Light beige with faint gray plus (+) grid.
  const containerStyle: React.CSSProperties = {
      ...styles.container,
      ...plusGridBackground, // Add plus grid style
  };

  return (
    <div style={containerStyle}>
        {/* Header */}
        <div style={styles.header}>
            <h1 style={styles.headerTitle}>{foiId}</h1>
            <button onClick={onCollapse} style={styles.collapseButton} title="Collapse Field of Interest View">
                <XCircle size={24} color="#555" />
            </button>
        </div>

        {/* Content Area - Program Graph */}
        <div style={styles.contentArea}>
            <ProgramGraph
                foiId={foiId}
                programs={foiData.programs}
                searchTerm={searchTerm}
            />
        </div>
    </div>
  );
};

// Basic styles - refine later according to PRD
const HEADER_HEIGHT = '60px'; // Define a fixed header height (adjust as needed)

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden', // Prevent container itself from scrolling
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px', // Consistent padding
    borderBottom: '1px solid #ddd',
    // Removed marginBottom
    flexShrink: 0, // Prevent header from shrinking
    height: HEADER_HEIGHT, // Apply fixed height
    boxSizing: 'border-box', // Include padding in height
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px', // Slightly smaller to fit fixed height better
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapseButton: {
    background: 'none',
    border: 'none',
    padding: '5px',
    cursor: 'pointer',
    lineHeight: 0,
    flexShrink: 0, // Prevent button from shrinking
  },
  contentArea: {
    height: `calc(100% - ${HEADER_HEIGHT})`,
    padding: '0', // Reverted padding
    overflow: 'hidden',
    position: 'relative',
    // boxSizing: 'border-box', // Remove box-sizing as padding is 0
  },
};

// PRD 5.3: Faint gray plus (+) grid - Changed to dot grid and PRD color
const plusGridBackground: React.CSSProperties = {
    backgroundColor: '#F5F5DC', // PRD: Very light beige
    backgroundImage: 'radial-gradient(#D3D3D3 0.5px, transparent 0.5px)', // PRD: Subtle gray dots
    backgroundSize: '15px 15px', // Size of the repeating dot pattern
};

export default ExpandedFoiView; 