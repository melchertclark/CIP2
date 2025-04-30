import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { RootState, AppDispatch, updateFoiIncluded, FoiData, ProgramData, updateProgramIncluded } from './store';
import FoiCard, { MINIMAL_WIDTH, MINIMAL_HEIGHT, PARTIAL_WIDTH, PARTIAL_HEIGHT } from './FoiCard'; // Import dimensions

// Define types for D3 simulation nodes based on FoI data
export interface FoiNode extends d3.SimulationNodeDatum {
  id: string; // Corresponds to the FoI name (key in AppData)
  data: FoiData; // Keep original data for rendering
}

// Define the structure for D3 links (even if not visually rendered initially)
// For FoIs, there are no explicit links in the data, but D3 forces often use them.
// We might not need links if we only use forces like charge and center.
// type FoiLink = d3.SimulationLinkDatum<FoiNode>;

// Define props for FoIGraph
interface FoIGraphProps {
  searchTerm: string;
  onExpandClick: (foiId: string) => void; // Add prop for handling expand clicks
}

// Define an even larger logical canvas size for zoom-out effect
const LOGICAL_WIDTH = 2000; // Increased further
const LOGICAL_HEIGHT = 1500; // Increased further

const FoIGraph: React.FC<FoIGraphProps> = ({ searchTerm, onExpandClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div to get dimensions
  const fileData = useSelector((state: RootState) => state.app.present.fileData);
  const dispatch = useDispatch<AppDispatch>(); // Get dispatch function
  const [nodes, setNodes] = useState<FoiNode[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 }); // Keep this for SVG element size
  const [activeCardId, setActiveCardId] = useState<string | null>(null); // Track active card ID
  // Store the simulation in a ref to update it without triggering effect re-run
  const simulationRef = useRef<d3.Simulation<FoiNode, undefined> | null>(null);

  console.log('[FoIGraph.tsx] Rendering - Received fileData:', fileData);

  // Prepare nodes data - Attempt to preserve node object identity
  const foiNodes = useMemo<FoiNode[]>(() => {
    console.log('[FoIGraph.tsx] Recalculating foiNodes. fileData present:', !!fileData);
    if (!fileData) return [];

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // Create a map of current nodes for quick lookup
    const currentNodesMap = new Map(nodes.map(node => [node.id, node]));

    return Object.entries(fileData)
      .filter(([_, foiData]) => (foiData as FoiData).programs && (foiData as FoiData).programs.length > 0)
      .filter(([foiName, _]) => {
          if (!lowerCaseSearchTerm) return true;
          return foiName.toLowerCase().includes(lowerCaseSearchTerm);
      })
      .map(([foiName, foiData]) => {
          // Try to reuse existing node object
          const existingNode = currentNodesMap.get(foiName);
          if (existingNode) {
              // Update data, keep position/velocity info from simulation
              existingNode.data = foiData as FoiData;
              return existingNode;
          } else {
              // Create new node object if it didn't exist before
              return {
                  id: foiName,
                  data: foiData as FoiData,
                  // Use LOGICAL dimensions for initial placement
                  x: LOGICAL_WIDTH / 2 + (Math.random() - 0.5) * 50,
                  y: LOGICAL_HEIGHT / 2 + (Math.random() - 0.5) * 50,
              };
          }
      });
  }, [fileData, searchTerm, /* dimensions.width, dimensions.height, */ nodes]); // Add nodes state as dependency

  // Effect to update dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize(); // Initial size
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Callback for FoI inclusion change
  const handleInclusionChange = useCallback((foiName: string, included: boolean) => {
      dispatch(updateFoiIncluded({ foiName, included }));
  }, [dispatch]);

  // Callback for FoI Expand click (passed down to card)
  const handleExpandFoiRequest = useCallback((foiId: string) => {
      // Can add logic here if FoIGraph needs to do something before passing up
      onExpandClick(foiId);
  }, [onExpandClick]);

  // Effect for D3 simulation
  useEffect(() => {
    if (!svgRef.current) return;

    // Initialize simulation if it doesn't exist
    if (!simulationRef.current) {
        simulationRef.current = d3.forceSimulation<FoiNode>()
          // Attractive force
          .force('charge', d3.forceManyBody().strength(+5)) // Positive strength = attraction
          // Centering force - Keep strong
          .force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.20)) // Slightly reduced from extreme
          // Collision detection - Use PREVIOUS partial dimensions for spacing
          .force('collision', d3.forceCollide().radius(Math.hypot(280, 180) / 2 - 5).strength(0.9)) // Old: PARTIAL_WIDTH=280, PARTIAL_HEIGHT=180
          // X/Y forces - Keep strong
          .force('x', d3.forceX(LOGICAL_WIDTH / 2).strength(0.08))
          .force('y', d3.forceY(LOGICAL_HEIGHT / 2).strength(0.08))
          .on('tick', () => {
            // Update the state with new node positions directly from simulation ref
            setNodes([...(simulationRef.current?.nodes() || [])]);
          });
    }

    const simulation = simulationRef.current;

    // Update simulation nodes
    simulation.nodes(foiNodes);

    // Update forces - Use LOGICAL dimensions
    // Update collision force radius as well, in case it wasn't just initialized
    const oldCollisionRadius = Math.hypot(280, 180) / 2 - 5; // Old: PARTIAL_WIDTH=280, PARTIAL_HEIGHT=180
    (simulation.force('collision') as d3.ForceCollide<FoiNode>).radius(oldCollisionRadius);
    simulation.force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.20));
    simulation.force('x', d3.forceX(LOGICAL_WIDTH / 2).strength(0.08));
    simulation.force('y', d3.forceY(LOGICAL_HEIGHT / 2).strength(0.08));

    // Restart simulation gently
    simulation.alpha(0.3).restart();

  }, [foiNodes]); // Remove dimensions from dependencies

  // --- Background Click Handler ---
  const handleBackgroundClick = () => {
    setActiveCardId(null); // Collapse any active card
  };
  // --- End Background Click Handler ---

  // --- Effect for Escape Key Listener ---
  useEffect(() => {
    const handleEsc = () => {
        console.log('FoIGraph detected Esc');
        // If a card is partially expanded, collapse it
        setActiveCardId(null);
    };
    window.addEventListener('escPressed', handleEsc);
    return () => window.removeEventListener('escPressed', handleEsc);
  }, [setActiveCardId]); // Dependency on setter

  // ---- Rendering ----
  // PRD 5.2: Background color and grid - handled by parent div in App.tsx for now
  // PRD 5.2: Controls (Top Floating Bar) - To be added in App.tsx

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={handleBackgroundClick} // Add click handler to the main container
    >
      <svg
         ref={svgRef}
         width={dimensions.width}
         height={dimensions.height}
         viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
         preserveAspectRatio="xMidYMid meet" // Standard scaling behavior
      >
        {/* Optional: Add a background rect if needed for more precise click target */}
        {/* <rect width="100%" height="100%" fill="transparent" /> */}
        <g>
          {/* Render nodes using FoiCard component */}
          {nodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}>
               <FoiCard
                 node={node}
                 isActive={activeCardId === node.id} // Pass active state down
                 setActive={setActiveCardId}      // Pass setter down
                 onInclusionChange={handleInclusionChange}
                 onExpandRequest={handleExpandFoiRequest} // Pass down the expand handler
                 searchTerm={searchTerm} // Pass search term down
               />
            </g>
          ))}
        </g>
        {/* TODO: Render links if needed */}
        {/* <g className="links">
          {links.map((link, i) => (
            <line key={i} x1={link.source.x} y1={link.source.y} x2={link.target.x} y2={link.target.y} stroke="#999" />
          ))}
        </g> */}
      </svg>
    </div>
  );
};

export default FoIGraph; 