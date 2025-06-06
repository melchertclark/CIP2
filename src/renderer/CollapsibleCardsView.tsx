import React, { useState, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link as LinkIcon } from 'react-feather';
import HighlightText from './HighlightText';
import {
  RootState,
  AppDispatch,
  FoiData,
  ProgramData,
  updateFoiIncluded,
  updateProgramIncluded,
  updateProgramDetails,
  moveProgram,
  setLoading,
  setError,
  setStatusMessage,
} from './store';

const CollapsibleCardsView: React.FC<{ searchTerm: string }> = ({ searchTerm }) => {
  const dispatch = useDispatch<AppDispatch>();
  const fileData = useSelector((state: RootState) => state.app.present.fileData);
  if (!fileData) {
    return null;
  }

  // All FoI names for dropdowns
  const allFoiNames = useMemo(() => Object.keys(fileData), [fileData]);
  const lowerSearch = searchTerm.toLowerCase();

  // Filter FoIs by searchTerm matching FoI name or any program name/description
  const filteredFoIs = useMemo(
    () =>
      Object.entries(fileData).filter(([foiName, foiData]) => {
        if (!searchTerm) return true;
        if (foiName.toLowerCase().includes(lowerSearch)) return true;
        return foiData.programs.some(
          (p) =>
            p.name.toLowerCase().includes(lowerSearch) ||
            (p.description?.toLowerCase().includes(lowerSearch) ?? false)
        );
      }),
    [fileData, lowerSearch, searchTerm]
  );

  const [expandedFoIs, setExpandedFoIs] = useState<Set<string>>(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [moveTrigger, setMoveTrigger] = useState(false);

  const handleToggleFoi = (foiName: string, included: boolean) => {
    dispatch(updateFoiIncluded({ foiName, included }));
  };

  const handleToggleProgram = (
    foiName: string,
    programId: string,
    included: boolean
  ) => {
    dispatch(updateProgramIncluded({ foiName, programId, included }));
  };

  const handleEditProgramField = (
    foiName: string,
    programId: string,
    field: keyof Omit<ProgramData, 'included'>,
    value: string | null
  ) => {
    dispatch(updateProgramDetails({ foiName, programId, field, value }));
  };

  const handleMoveProgram = (
    programId: string,
    sourceFoi: string,
    targetFoi: string
  ) => {
    dispatch(
      moveProgram({ sourceFoiName: sourceFoi, targetFoiName: targetFoi, programId })
    );
    setMoveTrigger((prev) => !prev);
  };

  // Auto-save on program move
  useEffect(() => {
    if (moveTrigger && fileData) {
      (async () => {
        dispatch(setLoading(true));
        dispatch(setError(null));
        dispatch(setStatusMessage('Auto-saving...'));
        const content = JSON.stringify(fileData, null, 2);
        try {
          const result = await window.electronAPI.saveFile(content);
          if (result.error) {
            dispatch(setError(`Auto-save failed: ${result.error}`));
            dispatch(setStatusMessage(null));
          } else {
            dispatch(setStatusMessage('Auto-save successful.'));
          }
        } catch (err: any) {
          dispatch(setError(`Auto-save failed: ${err.message || 'Unknown error'}`));
        } finally {
          dispatch(setLoading(false));
          setTimeout(() => dispatch(setStatusMessage(null)), 3000);
        }
      })();
    }
  }, [dispatch, moveTrigger, fileData]);

  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px',
      overflowY: 'auto',
      height: '100%',
      boxSizing: 'border-box',
    },
    card: {
      backgroundColor: '#E8E4C9',
      borderRadius: '8px',
      border: '1px solid #ccc',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #ccc',
    },
    button: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      width: '24px',
      height: '24px',
      lineHeight: 1,
      padding: 0,
    },
    title: {
      flexGrow: 1,
      margin: '0 8px',
      fontWeight: 'bold',
      fontSize: '16px',
      wordBreak: 'break-word',
    },
    toggleLabel: {
      display: 'inline-block',
      marginLeft: '8px',
    },
    content: {
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    foiDetails: {
      display: 'flex',
      gap: '16px',
      fontSize: '14px',
    },
    programList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    programCard: {
      backgroundColor: '#E8E4C9',
      borderRadius: '6px',
      border: '1px solid #bbb',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    fieldRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    fieldLabel: {
      flexShrink: 0,
      width: '80px',
      fontWeight: 'bold',
      fontSize: '14px',
    },
    fieldInput: {
      flexGrow: 1,
      padding: '4px 6px',
      fontSize: '14px',
    },
    fieldTextarea: {
      flexGrow: 1,
      padding: '4px 6px',
      fontSize: '14px',
      minHeight: '60px',
      resize: 'vertical',
    },
    fieldSelect: {
      flexGrow: 1,
      padding: '4px 6px',
      fontSize: '14px',
    },
  };

  return (
    <div style={styles.container}>
      {filteredFoIs.map(([foiName, foiData]: [string, FoiData]) => {
        const foiExpanded = expandedFoIs.has(foiName);
        const toggleFoi = () => {
          setExpandedFoIs((prev) => {
            const next = new Set(prev);
            next.has(foiName) ? next.delete(foiName) : next.add(foiName);
            return next;
          });
        };
        const filteredPrograms = foiData.programs.filter(
          (p) =>
            !searchTerm ||
            p.name.toLowerCase().includes(lowerSearch) ||
            (p.description?.toLowerCase().includes(lowerSearch) ?? false)
        );
        return (
          <div key={foiName} style={styles.card}>
            <div style={styles.header}>
              <button onClick={toggleFoi} style={styles.button}>
                {foiExpanded ? '−' : '+'}
              </button>
              <div style={styles.title}>
                <HighlightText text={foiName} highlight={searchTerm} />
              </div>
              <label className="toggle-switch" style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={foiData.included}
                  onChange={(e) => handleToggleFoi(foiName, e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            {foiExpanded && (
              <div style={styles.content}>
                <div style={styles.foiDetails}>
                  <div>
                    Population: {foiData.population?.count?.toLocaleString() ?? 'N/A'}
                    {foiData.population?.as_of &&
                      ` (as of ${foiData.population.as_of})`}
                  </div>
                  <div>Programs: {foiData.programs.length}</div>
                </div>
                <div style={styles.programList}>
                  {filteredPrograms.map((program: ProgramData) => {
                    const pid = program.link;
                    const progExpanded = expandedPrograms.has(pid);
                    const toggleProg = () => {
                      setExpandedPrograms((prev) => {
                        const next = new Set(prev);
                        next.has(pid) ? next.delete(pid) : next.add(pid);
                        return next;
                      });
                    };
                    return (
                      <div key={pid} style={styles.programCard}>
                        <div style={styles.header}>
                          <button onClick={toggleProg} style={styles.button}>
                            {progExpanded ? '−' : '+'}
                          </button>
                          <div style={styles.title}>
                            <HighlightText text={program.name} highlight={searchTerm} />
                          </div>
                          <label className="toggle-switch" style={styles.toggleLabel}>
                            <input
                              type="checkbox"
                              checked={program.included}
                              onChange={(e) =>
                                handleToggleProgram(
                                  foiName,
                                  pid,
                                  e.target.checked
                                )
                              }
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                        {progExpanded && (
                          <div style={styles.content}>
                            <div style={styles.fieldRow}>
                              <label style={styles.fieldLabel}>Degree:</label>
                              <input
                                style={styles.fieldInput}
                                type="text"
                                value={program.degree ?? ''}
                                onChange={(e) =>
                                  handleEditProgramField(
                                    foiName,
                                    pid,
                                    'degree',
                                    e.target.value || null
                                  )
                                }
                              />
                            </div>
                            <div style={styles.fieldRow}>
                              <label style={styles.fieldLabel}>
                                Description:
                              </label>
                              <textarea
                                style={styles.fieldTextarea}
                                value={program.description ?? ''}
                                onChange={(e) =>
                                  handleEditProgramField(
                                    foiName,
                                    pid,
                                    'description',
                                    e.target.value || null
                                  )
                                }
                              />
                            </div>
                            <div style={styles.fieldRow}>
                              <label style={styles.fieldLabel}>Link:</label>
                              <input
                                style={styles.fieldInput}
                                type="url"
                                value={program.link}
                                onChange={(e) =>
                                  handleEditProgramField(
                                    foiName,
                                    pid,
                                    'link',
                                    e.target.value || null
                                  )
                                }
                              />
                            </div>
                            <div style={styles.fieldRow}>
                              <label style={styles.fieldLabel}>
                                Move to FoI:
                              </label>
                              <select
                                style={styles.fieldSelect}
                                value={foiName}
                                onChange={(e) =>
                                  handleMoveProgram(pid, foiName, e.target.value)
                                }
                              >
                                {allFoiNames.map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={styles.fieldRow}>
                              <button
                                onClick={() => window.open(program.link, '_blank')}
                              >
                                <LinkIcon size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CollapsibleCardsView;