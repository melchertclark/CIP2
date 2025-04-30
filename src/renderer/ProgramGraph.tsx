import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { ProgramData, RootState, AppDispatch, updateProgramIncluded } from './store'; // Import necessary types/actions
import ProgramCard, { MINIMAL_WIDTH, MINIMAL_HEIGHT, PARTIAL_WIDTH, PARTIAL_HEIGHT, FULL_WIDTH, FULL_HEIGHT } from './ProgramCard';
// TODO: Import ProgramCard and its dimensions later

// Define types for D3 simulation nodes based on Program data
export interface ProgramNode extends d3.SimulationNodeDatum {
  id: string; // Use program name or maybe link as unique ID? Let's use link for now as names might not be unique.
  data: ProgramData;
}

// Props for ProgramGraph
interface ProgramGraphProps {
  foiId: string; // Need the parent FoI ID for dispatching updates
  programs: ProgramData[];
  searchTerm: string;
}

// Define an even larger logical canvas size for zoom-out effect
const LOGICAL_WIDTH = 4500; // 1500 * 3
const LOGICAL_HEIGHT = 3375; // 1125 * 3

const ProgramGraph: React.FC<ProgramGraphProps> = ({ foiId, programs, searchTerm }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch<AppDispatch>(); // Get dispatch
  const [nodes, setNodes] = useState<ProgramNode[]>([]); // D3 nodes (only non-expanded)
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 }); // Keep for SVG element size
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null); // Track partially active program ID
  const [fullyExpandedProgramIds, setFullyExpandedProgramIds] = useState<string[]>([]); // Track fully expanded program IDs
  // Add simulation ref for stability
  const simulationRef = useRef<d3.Simulation<ProgramNode, undefined> | null>(null);

  // Prepare node data for D3 simulation (filter out fully expanded ones)
  const programNodesForSimulation = useMemo<Omit<ProgramNode, 'x' | 'y' | 'vx' | 'vy'>[]>(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const uniqueIds = new Set<string>();
    const nodesWithData: Omit<ProgramNode, 'x' | 'y' | 'vx' | 'vy'>[] = [];

    programs.forEach((program) => {
        // Check uniqueness
        if (uniqueIds.has(program.link)) {
            console.warn(`[ProgramGraph] Duplicate program link found for FoI '${foiId}': ${program.link}.`);
        } else {
            uniqueIds.add(program.link);
        }

        // Filter based on search term AND if NOT fully expanded
        const isExpanded = fullyExpandedProgramIds.includes(program.link);
        if (!isExpanded) {
            const nameMatch = program.name.toLowerCase().includes(lowerCaseSearchTerm);
            const descMatch = program.description?.toLowerCase().includes(lowerCaseSearchTerm) ?? false;
            if (!lowerCaseSearchTerm || nameMatch || descMatch) {
                nodesWithData.push({
                    id: program.link,
                    data: program,
                });
            }
        }
    });
    return nodesWithData;
  }, [programs, searchTerm, foiId, fullyExpandedProgramIds]); // Add fullyExpandedProgramIds dependency

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
    // Use ResizeObserver for more reliability within potentially changing containers
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);
        updateSize(); // Initial size check
    }
    return () => {
        if (resizeObserver && containerRef.current) {
            resizeObserver.unobserve(containerRef.current);
        }
    };
  }, []); // Observe container ref changes

  // Effect for D3 simulation - Increase Center Strength
  useEffect(() => {
    if (!svgRef.current) return;

    // Calculate collision radius based on imported PARTIAL dimensions
    // Use partial width/height as it's the largest state within this graph view
    const collisionRadius = Math.hypot(PARTIAL_WIDTH, PARTIAL_HEIGHT) / 2 - 5; // Use current partial size (original)

    // Initialize simulation if it doesn't exist
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<ProgramNode>()
        // Restore forces identical to FoI Graph
        // .force('charge', d3.forceManyBody().strength(+5))
        .force('charge', d3.forceManyBody().strength(-300)) // Negative strength = repulsion
        // .force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.20))
        .force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.40)) // Increased strength
        // Collision detection - Use calculated radius based on PARTIAL dimensions
        // .force('collision', d3.forceCollide().radius(Math.hypot(200, 130) / 2 - 5).strength(0.9)) // Old: PARTIAL_WIDTH=200, PARTIAL_HEIGHT=130
        .force('collision', d3.forceCollide().radius(collisionRadius).strength(0.9)) // Use new radius
        .force('x', d3.forceX(LOGICAL_WIDTH / 2).strength(0.08))
        .force('y', d3.forceY(LOGICAL_HEIGHT / 2).strength(0.08))
        .on('tick', () => {
            const currentNodes = simulationRef.current?.nodes() || [];
            // Check for invalid coordinates
            const invalidNode = currentNodes.find(n => isNaN(n.x ?? 0) || isNaN(n.y ?? 0));
            if (invalidNode) {
                console.error(`[ProgramGraph Tick] Invalid coordinates detected for node ${invalidNode.id}:`, invalidNode.x, invalidNode.y);
                simulationRef.current?.stop();
                return;
            }

            // Clamp positions within bounds - Account for largest (partial) card size
            const halfWidth = PARTIAL_WIDTH / 2;
            const halfHeight = PARTIAL_HEIGHT / 2;
            currentNodes.forEach(node => {
                node.x = Math.max(halfWidth, Math.min(LOGICAL_WIDTH - halfWidth, node.x ?? 0));
                node.y = Math.max(halfHeight, Math.min(LOGICAL_HEIGHT - halfHeight, node.y ?? 0));
            });

            // Log average Y position (optional)
            // if (currentNodes.length > 0) {
            //     const avgY = currentNodes.reduce((sum, node) => sum + (node.y ?? 0), 0) / currentNodes.length;
            //     console.log(`[ProgramGraph Tick] Avg Y: ${avgY.toFixed(2)}`);
            // }

            // Update state from simulation ref
            setNodes([...currentNodes]);
        });
    }

    const simulation = simulationRef.current;
    // Update forces to match FoI Graph
    // Update charge force
    // simulation.force('charge', d3.forceManyBody().strength(+5));
    simulation.force('charge', d3.forceManyBody().strength(-300)); // Ensure repulsion is set
    // Update collision force radius
    // const oldCollisionRadius = Math.hypot(200, 130) / 2 - 5; // Old: PARTIAL_WIDTH=200, PARTIAL_HEIGHT=130
    (simulation.force('collision') as d3.ForceCollide<ProgramNode>).radius(collisionRadius); // Use new radius (original)
    // simulation.force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.20));
    simulation.force('center', d3.forceCenter(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2).strength(0.40)); // Update strength here too
    simulation.force('x', d3.forceX(LOGICAL_WIDTH / 2).strength(0.08));
    simulation.force('y', d3.forceY(LOGICAL_HEIGHT / 2).strength(0.08));

    // --- Preserve Node Positions/Velocities (using programNodesForSimulation) --- 
    const currentSimNodes = simulation.nodes();
    const currentSimNodesMap = new Map(currentSimNodes.map(node => [node.id, node]));

    const updatedProgramNodes = programNodesForSimulation.map(newNodeData => { // Use filtered data
        const existingNode = currentSimNodesMap.get(newNodeData.id);
        if (existingNode) {
            return { 
                ...existingNode,
                data: newNodeData.data
            };
        } else {
            return {
                ...newNodeData,
                x: LOGICAL_WIDTH / 2 + (Math.random() - 0.5) * 50,
                y: LOGICAL_HEIGHT / 3 + (Math.random() - 0.5) * 50,
                vx: 0, vy: 0
            };
        }
    });
    // --- End Preservation --- 

    simulation.nodes(updatedProgramNodes); // Update simulation with ONLY non-expanded nodes
    simulation.alpha(0.3).restart();

  // Now depends only on the calculated list of nodes to display
  }, [programNodesForSimulation]);

  // --- Effect for Escape Key Listener ---
  useEffect(() => {
    const handleEsc = () => {
        console.log('ProgramGraph detected Esc');
        // PRD LIFO collapse on Esc for fully expanded cards, then partial
        if (fullyExpandedProgramIds.length > 0) {
            setFullyExpandedProgramIds(prev => prev.slice(0, -1)); // Collapse last fully expanded
        } else if (activeProgramId) {
            setActiveProgramId(null); // Collapse partially expanded
        }
    };
    window.addEventListener('escPressed', handleEsc);
    return () => window.removeEventListener('escPressed', handleEsc);
  // Need all state setters/values used in handler as dependencies
  }, [activeProgramId, setActiveProgramId, fullyExpandedProgramIds, setFullyExpandedProgramIds]);

  // --- Handlers passed down to ProgramCard ---
  const handleProgramClick = useCallback((programId: string) => {
    // Clicking a minimal card makes it partially active
    // Clicking the background or contract button makes it minimal (handled elsewhere)
    setActiveProgramId(prevId => (prevId === programId ? null : programId));
  }, []);

  const handleProgramInclusionChange = useCallback((programLink: string, included: boolean) => {
    dispatch(updateProgramIncluded({ foiName: foiId, programId: programLink, included }));
  }, [dispatch, foiId]);

  const handleProgramExpandRequest = useCallback((programId: string) => {
    setFullyExpandedProgramIds(prev => {
        if (prev.includes(programId)) return prev;
        if (prev.length >= 3) return [...prev.slice(1), programId];
        return [...prev, programId];
    });
    setActiveProgramId(programId);
  }, []);

  const handleProgramCollapseRequest = useCallback((programId: string) => {
    setFullyExpandedProgramIds(prev => prev.filter(id => id !== programId));
    // Optionally, set the partially active card to null too if desired
    // setActiveProgramId(null);
  }, []);

  // --- End Handlers ---

  // --- Background Click Handler ---
  const handleBackgroundClick = () => {
    // PRD 5.5: Click outside (on FoI view background) -> Contracts most recently expanded program card (LIFO).
    if (fullyExpandedProgramIds.length > 0) {
        // Remove the last added fully expanded card
        setFullyExpandedProgramIds(prev => prev.slice(0, -1));
    } else {
        // If no fully expanded cards, collapse the partially expanded one
        setActiveProgramId(null);
    }
  };
  // --- End Background Click Handler ---

  // Create a map for quick lookup of D3 node positions
  const d3NodesMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={handleBackgroundClick}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          {/* Render ALL programs, position based on state */}
          {programs.map((program) => {
            const isFullyExpandedFlag = fullyExpandedProgramIds.includes(program.link);
            const d3Node = d3NodesMap.get(program.link);

            if (isFullyExpandedFlag) {
              const expandedIndex = fullyExpandedProgramIds.indexOf(program.link);
              
              // Position fixed in 1/3 columns within SVG coordinates, with margins
              const svgMargin = 100; // Margin in SVG units
              const availableSvgWidth = LOGICAL_WIDTH - (2 * svgMargin);
              const columnSvgWidth = availableSvgWidth / 3;
              const xSvgPosition = svgMargin + (expandedIndex * columnSvgWidth) + (columnSvgWidth / 2); // Center in column
              const ySvgPosition = LOGICAL_HEIGHT / 2; // Center vertically in logical space
              
              return (
                <g key={program.link} transform={`translate(${xSvgPosition}, ${ySvgPosition})`}>
                  <ProgramCard
                    node={{ id: program.link, data: program }} // Pass data directly
                    parentFoiName={foiId}
                    searchTerm={searchTerm}
                    isActive={activeProgramId === program.link} // Still track active
                    isFullyExpanded={true} // Explicitly true
                    setActive={setActiveProgramId}
                    onInclusionChange={handleProgramInclusionChange}
                    onExpandRequest={handleProgramExpandRequest} 
                    onCollapseRequest={handleProgramCollapseRequest}
                  />
                </g>
              );
            } else if (d3Node) {
              // Render non-expanded cards using D3 positions
              return (
                <g key={d3Node.id} transform={`translate(${d3Node.x ?? 0}, ${d3Node.y ?? 0})`}>
                   <ProgramCard
                    node={d3Node} // Use D3 node data (includes position)
                    parentFoiName={foiId}
                    searchTerm={searchTerm}
                    isActive={activeProgramId === d3Node.id}
                    isFullyExpanded={false} // Explicitly false
                    setActive={setActiveProgramId}
                    onInclusionChange={handleProgramInclusionChange}
                    onExpandRequest={handleProgramExpandRequest} 
                    onCollapseRequest={handleProgramCollapseRequest}
                  />
                </g>
              );
            } else {
              // Should not happen if program exists but isn't expanded or in D3 nodes
              // Could happen briefly during transitions or if filtered by search term
              return null; 
            }
          })}
        </g>
      </svg>
    </div>
  );
};

export default ProgramGraph; 