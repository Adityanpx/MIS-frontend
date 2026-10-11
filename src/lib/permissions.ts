import type { MyPlantRole } from '@/lib/auth/types';

/**
 * TRD §8.4 permission matrix. `can()` only hides/disables UI — the API is the authority (403/404/423).
 *   CA = client_admin, E = editor, C = checker/verifier, V = viewer
 */
export type PlantAction =
  | 'logsheet.view'
  | 'logsheet.edit'
  | 'logsheet.correct'
  | 'logsheet.requestCorrection'
  | 'logsheet.approve'
  | 'settings.view'
  | 'settings.edit'
  | 'pdf.generate'
  | 'pdf.zip'
  | 'reports.view'
  | 'corrections.manage'
  | 'imports.manage'
  | 'revenue.view';

const MATRIX: Record<PlantAction, MyPlantRole[]> = {
  'logsheet.view': ['client_admin', 'editor', 'checker', 'verifier', 'viewer'],
  'logsheet.edit': ['client_admin', 'editor'],
  'logsheet.correct': ['client_admin'],
  'logsheet.requestCorrection': ['editor'],
  'logsheet.approve': ['client_admin', 'checker', 'verifier'],
  'settings.view': ['client_admin', 'editor', 'checker', 'verifier'],
  'settings.edit': ['client_admin'],
  'pdf.generate': ['client_admin', 'editor'],
  'pdf.zip': ['client_admin'],
  'reports.view': ['client_admin', 'editor', 'checker', 'verifier', 'viewer'],
  'corrections.manage': ['client_admin'],
  'imports.manage': ['client_admin'],
  'revenue.view': ['client_admin'],
};

export function can(role: MyPlantRole | null | undefined, action: PlantAction): boolean {
  return !!role && MATRIX[action].includes(role);
}

/** Account states in which writes are refused by the API (423). */
export const READ_ONLY_STATES = ['read_only', 'expired', 'suspended', 'terminated'];
export const isWriteBlocked = (accountState: string | null | undefined) =>
  !!accountState && READ_ONLY_STATES.includes(accountState);

export const ROLE_LABEL: Record<string, string> = {
  client_admin: 'Client Admin',
  editor: 'Editor',
  checker: 'Checker',
  verifier: 'Verifier',
  viewer: 'Viewer',
};
