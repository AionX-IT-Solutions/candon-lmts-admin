export interface AuthUser {
  /** Supabase Auth user id (= users.id) */
  id: string
  username: string
  firstName: string
  middleName: string
  lastName: string
  birthday: string
  role: string
  privileges: string[]
  filePath: string
}

export interface LoginRequest {
  data: { username: string; password: string }
}

export interface LoginResponse {
  status: number
  message: string
  data: {
    success: string
    privileges: string[]
    role: string
    firstName: string
    middleName: string
    lastName: string
    filePath: string
  }
}

// Ordinance
export interface Ordinance {
  id: string
  ordinanceNumber: string
  category: string
  title: string
  author: string
  tag: string
  fileType: string
  filePath: string
  dateApprovedSp: string
  actionSp: string
  transmittedDateMayor: string
  actionMayor: string
  transmittedDateSP: string
  actionTSp: string
  dateReceived: string
  postingDate: string
  publicationDate: string
  created?: string
  updated?: string
}

export interface OrdinanceListResponse {
  status: number
  message: string
  data: { ordinance: Ordinance[]; last: string }
}

// Resolution
export interface Resolution {
  id: string
  resolutionNumber: string
  category: string
  title: string
  author: string
  tag: string
  fileType: string
  filePath: string
  dateApprovedSp: string
  actionSp: string
  transmittedDateMayor: string
  actionMayor: string
  transmittedDateSP: string
  actionTSp: string
  dateReceived: string
  postingDate: string
  publicationDate: string
  created?: string
  updated?: string
}

export interface ResolutionListResponse {
  status: number
  message: string
  data: { resolution: Resolution[]; last: string }
}

// Tricycle
export interface Tricycle {
  id: string
  name: string
  address: string
  make: string
  motorNo: string
  chassisNo: string
  plateNo: string
  franchiseNo: string
  ordinanceNumber: string
  expiration: string
  dateReceived: string
  timeReceived: string
  fileType: string
  filePath: string
  natureOfFranchise: string
  category: string
  action: string
}

export interface TricycleListResponse {
  status: number
  message: string
  data: { tricy: Tricycle[]; last: string }
}

// Minutes
export interface Minutes {
  id: string
  sessionNo: string
  date: string
  category: string
  time?: string
  callOrder?: string
  place?: string
  agenda?: string
  tag?: string
  present?: string[]
  absent?: string[]
  adjournmentTime?: string
  prayer?: string
  /** Council term (terms.id) */
  termId?: string
  fileType: string
  filePath: string
  created?: string
  updated?: string
}

export interface MinutesListResponse {
  status: number
  message: string
  data: { minutes: Minutes[]; last: string }
}

// Communication
export interface Communication {
  id: string
  author: string[]
  coAuthor: string[]
  sponsor: string[]
  authorOfficialIds?: string[]
  coAuthorOfficialIds?: string[]
  sponsorOfficialIds?: string[]
  source: string
  communicationNo: string
  title: string
  sessionNo: string
  status: string
  tag: string
  dateReceived: string
  timeReceived: string
  fileType: string
  filePath: string
  created?: string
}

export interface CommunicationListResponse {
  status: number
  message: string
  data: { communication: Communication[]; last: string }
}

// Barangay Action
export interface BrgyAction {
  id: string
  brgy: string
  category: string
  measuresNo: string
  measuresTitle: string
  resolutionNumber: string
  action: string
  tag: string
  dateApproved: string
  dateReceived: string
  timeReceived: string
  dateReleased: string
  timeReleased: string
  fileType: string
  filePath: string
  created?: string
}

export interface BrgyActionListResponse {
  status: number
  message: string
  data: { brgy: BrgyAction[]; last: string }
}

// Transcript
export interface Transcript {
  id: string
  sessionNo: string
  sessionCategory: string
  transcriptNo: string
  tag: string
  fileType: string
  filePath: string
  created?: string
}

export interface TranscriptListResponse {
  status: number
  message: string
  data: { transcript: Transcript[]; last: string }
}

// Committee
// Council term (City Councils → Terms)
export interface Term {
  id: string
  name: string
  startDate?: string
  endDate?: string
  remarks?: string
}

export interface Committee {
  id: string
  title: string
  /** Council term (terms.id) */
  termId?: string
  description: string
  chairman: string
  viceChairman: string
  members: string[]
  created?: string
}

export interface CommitteeListResponse {
  status: number
  message: string
  data: { committee: Committee[]; last: string }
}

// Committee Reports
export interface CommitteeReport {
  id: string
  /** Committee Report, Committee Meeting Minutes or Committee Hearing Minutes */
  reportType?: string
  committeeReportsNo: string
  committee: string
  title: string
  measures: string[]
  sessionNo: string
  tag: string
  dateReceived: string
  timeReceived: string
  fileType: string
  filePath: string
  created?: string
}

export interface CommitteeReportListResponse {
  status: number
  message: string
  data: { committeeReport: CommitteeReport[]; last: string }
}

// Draft Ordinance
export interface DraftOrdinance {
  id: string
  draftOrdinanceNumber: string
  title: string
  author: string[]
  coAuthor: string[]
  sponsor: string[]
  authorOfficialIds?: string[]
  coAuthorOfficialIds?: string[]
  sponsorOfficialIds?: string[]
  sessionNo: string
  tag: string
  reading: string
  status: string
  actionCommittee: string
  actionReferred: string
  dateOfReading: string
  timeOfReading: string
  fileType: string
  filePath: string
  created?: string
  updated?: string
}

export interface DraftOrdinanceListResponse {
  status: number
  message: string
  data: { draftOrdinance: DraftOrdinance[]; last: string }
}

// Draft Resolution
export interface DraftResolution {
  id: string
  draftResolutionNumber: string
  title: string
  author: string[]
  coAuthor: string[]
  sponsor: string[]
  authorOfficialIds?: string[]
  coAuthorOfficialIds?: string[]
  sponsorOfficialIds?: string[]
  sessionNo: string
  tag?: string
  reading: string
  status: string
  actionOfOfficer: string
  dateReceived: string
  dateOfReading: string
  timeReceived: string
  fileType: string
  filePath: string
  created?: string
  updated?: string
}

export interface DraftResolutionListResponse {
  status: number
  message: string
  data: { draftResolution: DraftResolution[]; last: string }
}

// Review
export interface Review {
  id: string
  reviewNo: string
  title: string
  description: string
  districtCouncilor: string
  sessionNo: string
  tag: string
  dateReceived: string
  timeReceived: string
  category: string
  fileType: string
  filePath: string
  created?: string
}

export interface ReviewListResponse {
  status: number
  message: string
  data: { review: Review[]; last: string }
}

// Other Matters
export interface OtherMatter {
  id: string
  otherMattersNo: string
  title: string
  sessionNo: string
  dateReceived: string
  timeReceived: string
  status: string
  author: string
  tag: string
  fileType: string
  filePath: string
  created?: string
}

export interface OtherMatterListResponse {
  status: number
  message: string
  data: { matters: OtherMatter[]; last: string }
}

// Account
export interface Account {
  id: string
  username: string
  /** Sign-in email; blank = signs in with the username only */
  email?: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  role: string
  privileges: string[]
  contactNumber: string
  birthday: string
  gender: string
  address: string
  filePath: string
  officialId?: string
  officialIds?: string[]
}

export interface AccountListResponse {
  status: number
  message: string
  data: { accounts: Account[]; last: string }
}

// Officials
export interface Official {
  id: string
  /** Professional title written before the name, e.g. "Atty." */
  title?: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  position: string
  /** Council term (terms.id) */
  termId?: string
  /** Official this one reports to in the organization chart */
  reportsToId?: string
  /** Storage path of the official's photo */
  filePath?: string
  created?: string
  /** When the official was added (created_at) — sets their order on the chart and the list */
  createdAt?: string
}

export interface OfficialListResponse {
  status: number
  message: string
  data: { official: Official[]; last: string }
}

// Logs
export interface Log {
  id?: string
  name: string
  activity: string
  date: string
}

export interface LogsListResponse {
  status: number
  message: string
  data: { logs: Log[]; last: string }
}

// API wrapper
export interface ApiResponse<T = unknown> {
  status: number
  message: string
  data: T
}
