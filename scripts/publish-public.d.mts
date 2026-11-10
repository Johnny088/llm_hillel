export interface PublicFileRecord {
  fullPath: string;
  relPath: string;
}

export interface DevCourseState {
  lesson: number;
  lessonDir: string;
  provider: "openrouter";
  stage: "starter" | "development" | "solution";
  checkpoint: number;
}

export interface PublicState {
  releasedThrough: number;
}

export interface PublicSyncOptions {
  allowDirty?: boolean;
  preserveDev?: boolean;
  /** Test seam for a local mock remote; accepted only with preserveDev. */
  remoteUrl?: string;
}

export interface SecurityViolation {
  file: string;
  reason: string;
}

export interface FilterResult {
  allowed: PublicFileRecord[];
  excludedFuture: PublicFileRecord[];
  excludedPrivate: PublicFileRecord[];
  devIsReleased: boolean;
}

export function parseLessonNumber(lessonInput: string | number): number;
export function readPublicState(): Promise<PublicState>;
export function writePublicState(state: PublicState): Promise<void>;
export function readDevCourseState(): Promise<DevCourseState>;
export function collectAllTrackedAndWorkspaceFiles(): Promise<PublicFileRecord[]>;
export function filterFilesForRelease(
  allFiles: PublicFileRecord[],
  releasedThrough: number,
  devState: DevCourseState,
): FilterResult;
export function transformCohortSnapshotPackageJson(
  packageJsonText: string,
  cohort: { devMode?: string; devLesson?: number },
  releasedThrough: number,
): string;
export function validateSecurityAndBoundaries(
  files: PublicFileRecord[],
  releasedThrough: number,
): Promise<SecurityViolation[]>;
export function checkPrivateWorkingTreeClean(): { clean: boolean; status: string };
export function getPrivateHeadSha(): string;
export function showStatus(
  customPublicState?: PublicState,
  customDevState?: DevCourseState,
): Promise<unknown>;
export function checkOnly(
  customPublicState?: PublicState,
  customDevState?: DevCourseState,
): Promise<void>;
export function ensurePublicGitLabProject(): Promise<void>;
export function executePublicSync(
  cohortInput?: string | null,
  targetReleaseLevel?: number,
  options?: PublicSyncOptions,
): Promise<void>;
