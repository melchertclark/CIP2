import { configureStore, createSlice, PayloadAction, AnyAction } from '@reduxjs/toolkit';
import undoable, { excludeAction, StateWithHistory } from 'redux-undo'; // Import redux-undo

interface PopulationData {
  count: number | null;
  as_of: string | null;
}

export interface ProgramData {
  name: string;
  degree?: string | null;
  description?: string | null;
  link: string;
  included: boolean;
  [key: string]: any; // Allow unknown fields
}

export interface FoiData {
  included: boolean;
  population: PopulationData | null;
  programs: ProgramData[];
  [key: string]: any; // Allow unknown fields
}

export interface AppData {
  [foiName: string]: FoiData;
}

interface AppPresentState { // Renamed original AppState
  filePath: string | null;
  fileData: AppData | null;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null; // Added for feedback
}

// Initial state for the *present* part of the undoable state
const initialPresentState: AppPresentState = {
  filePath: null,
  fileData: null,
  isLoading: false,
  error: null,
  statusMessage: null,
};

export interface ProgramUpdatePayload {
    foiName: string;
    programId: string; // Using link as ID for now
    field: keyof Omit<ProgramData, 'included'>; // Field to update (e.g., 'name', 'degree', 'description', 'link')
    value: string | null; // New value for the field
}

export interface MoveProgramPayload {
    sourceFoiName: string;
    targetFoiName: string;
    programId: string; // Link
}
export interface PopulationUpdate {
  foiName: string;
  count: number;
  as_of: string;
}

const appSlice = createSlice({
  name: 'app',
  initialState: initialPresentState, // Use the present state initial value
  reducers: {
    // --- Non-Undoable Actions (will be filtered) ---
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    setStatusMessage: (state, action: PayloadAction<string | null>) => {
        state.statusMessage = action.payload;
    },
    setFilePath: (state, action: PayloadAction<string | null>) => {
        state.filePath = action.payload;
        if (action.payload) {
            state.isLoading = false;
            state.error = null;
            state.fileData = null;
            state.statusMessage = null;
        } else {
            state.fileData = null;
        }
    },
    // --- Undoable Actions (affect fileData) ---
    setFileData: (state, action: PayloadAction<AppData | null>) => {
      // This completely replaces data, should likely clear history or be initial state
      state.fileData = action.payload;
      if (action.payload !== null) {
          state.isLoading = false;
          state.error = null;
          state.statusMessage = null;
      }
    },
    updateFoiIncluded: (state, action: PayloadAction<{ foiName: string; included: boolean }>) => {
        const { foiName, included } = action.payload;
        if (state.fileData && state.fileData[foiName]) {
            state.fileData[foiName].included = included;
        } else {
            console.warn(`Attempted to update inclusion for non-existent FoI: ${foiName}`);
        }
    },
    updateProgramIncluded: (state, action: PayloadAction<{ foiName: string; programId: string; included: boolean }>) => {
        const { foiName, programId, included } = action.payload;
        const foi = state.fileData?.[foiName];
        if (foi) {
            const programIndex = foi.programs.findIndex(p => p.link === programId);
            if (programIndex !== -1) {
                foi.programs[programIndex].included = included;
            } else {
                console.warn(`Attempted to update inclusion for non-existent program ID: ${programId} in FoI: ${foiName}`);
            }
        } else {
            console.warn(`Attempted to update program inclusion for non-existent FoI: ${foiName}`);
        }
    },
    updateProgramDetails: (state, action: PayloadAction<ProgramUpdatePayload>) => {
        const { foiName, programId, field, value } = action.payload;
        const foi = state.fileData?.[foiName];
        if (foi) {
            const programIndex = foi.programs.findIndex(p => p.link === programId);
            if (programIndex !== -1) {
                if (field in foi.programs[programIndex]) {
                    (foi.programs[programIndex] as any)[field] = value;
                } else {
                     console.warn(`Attempted to update non-existent field '${field}' on program ID: ${programId} in FoI: ${foiName}`);
                }
            } else {
                console.warn(`Attempted to update details for non-existent program ID: ${programId} in FoI: ${foiName}`);
            }
        } else {
            console.warn(`Attempted to update program details for non-existent FoI: ${foiName}`);
        }
    },
    moveProgram: (state, action: PayloadAction<MoveProgramPayload>) => {
        const { sourceFoiName, targetFoiName, programId } = action.payload;
        const sourceFoi = state.fileData?.[sourceFoiName];
        const targetFoi = state.fileData?.[targetFoiName];

        if (sourceFoiName === targetFoiName) return;

        if (sourceFoi && targetFoi) {
            const programIndex = sourceFoi.programs.findIndex(p => p.link === programId);
            if (programIndex !== -1) {
                const [programToMove] = sourceFoi.programs.splice(programIndex, 1);
                targetFoi.programs.push(programToMove);
                console.log(`Moved program ${programId} from ${sourceFoiName} to ${targetFoiName}`);
            } else {
                console.warn(`Program ${programId} not found in source FoI ${sourceFoiName} for move.`);
            }
        } else {
            console.warn(`Source or target FoI not found for moving program ${programId}. Source: ${sourceFoiName}, Target: ${targetFoiName}`);
        }
    },
    updatePopulations: (state, action: PayloadAction<PopulationUpdate[]>) => {
      const updates = action.payload;
      if (!state.fileData) {
        console.warn('Attempted to update populations with no file data loaded.');
        return;
      }
      for (const { foiName, count, as_of } of updates) {
        if (!state.fileData[foiName]) {
          state.fileData[foiName] = { included: true, population: { count, as_of }, programs: [] };
        } else {
          state.fileData[foiName].population = { count, as_of };
        }
      }
    },
  },
});

// Export actions including the new one
export const {
    setLoading, setError, setStatusMessage, setFilePath, setFileData,
    updateFoiIncluded, updateProgramIncluded, updateProgramDetails, moveProgram, updatePopulations
} = appSlice.actions;

// List of action types to exclude from undo history
const excludedActions = [setLoading.type, setError.type, setStatusMessage.type, setFilePath.type];

// Create the undoable reducer
const undoableAppReducer = undoable(appSlice.reducer, {
    filter: excludeAction(excludedActions),
    limit: 100,
    syncFilter: true,
    // Indicate that setting initial file data should clear history
    // clearHistoryOnAction: (action: AnyAction) => action.type === setFileData.type || action.type === setFilePath.type, // REMOVED Invalid Option
});


export const store = configureStore({
  reducer: {
    app: undoableAppReducer, // Use the undoable reducer
  },
  // Middleware might be needed if actions cause performance issues with undo
});

// Define the RootState based on the undoable structure
export type RootState = {
    app: StateWithHistory<AppPresentState>; // Use StateWithHistory
};
export type AppDispatch = typeof store.dispatch;