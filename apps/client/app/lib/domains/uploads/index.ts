export {
  uploadRepository,
  assetDetailSelect,
} from "@/app/lib/domains/uploads/repository";
export { uploadService } from "@/app/lib/domains/uploads/service";
export type {
  UploadActor,
  OnboardingUploadActor,
  UploadServiceErrorCode,
  UploadServiceResult,
  PersistUploadedAssetInput,
  PersistedUploadResponse,
  OwnedAssetMetadata,
  DeleteOwnedAssetResponse,
  MaterializedUpload,
  StageOnboardingUploadInput,
  StagedOnboardingUpload,
  RequestDirectUploadInput,
  RequestedDirectUpload,
  ConfirmDirectUploadInput,
  ConfirmedDirectUpload,
  GetAssetDownloadUrlInput,
  AssetDownloadUrl,
  PutLocalDirectUploadObjectInput,
  LocalDirectDownloadObjectInput,
  LocalDirectDownloadObject,
} from "@/app/lib/domains/uploads/service";

export {
  getVirusScanner,
  registerVirusScanner,
  isRealScannerRegistered,
  setVirusScannerForTests,
  MockVirusScanner,
  type VirusScanner,
  type ScanResult,
  type ScanStatus,
} from "@/app/lib/domains/uploads/virus-scanner";

export {
  CloudmersiveVirusScanner,
  type CloudmersiveConfig,
} from "@/app/lib/domains/uploads/cloudmersive-scanner";

export {
  mapDbStatusToLifecycleState,
  isUploadLifecycleState,
  isValidTransition,
  isTerminalState,
  isCleanupEligible,
  isActiveUpload,
  buildExpiredStagedUploadFilter,
  type UploadLifecycleState,
} from "@/app/lib/domains/uploads/upload-lifecycle";
