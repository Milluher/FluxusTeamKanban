export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Last successful sign-in. Null for anyone who has not signed in since this was added. */
  lastLoginAt?: string | null;
}

export type PrdStatus = 'draft' | 'published';
export type PrdClassification = 'new_product' | 'major_feature' | 'minor_enhancement';

/**
 * §16 Administrative — a block of the PRD assigned to one board member.
 *
 * The author owns `role` and `assignee`; the assignee owns the two answers.
 * `ticket` is the task raised when the PRD is published, so it is absent while
 * the PRD is still a draft.
 */
export interface PrdAdminBlock {
  id: string;
  prdId: string;
  role: string;
  assigneeId: string;
  assignee: { id: string; name: string; email?: string };
  dataNeeded?: string | null;
  actionsNeeded?: string | null;
  ticketId?: string | null;
  ticket?: { id: string; title: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** §10 Target Personas — the join row, so the persona travels with it. */
export interface PrdPersonaLink {
  id: string;
  personaId: string;
  persona: { id: string; name: string; segment?: string | null };
}

/**
 * A PRD: the document behind a feature.
 *
 * Every section is optional on the type as well as in the database — a draft is
 * saved from the first keystroke, and "required" is a condition of publishing.
 */
export interface Prd {
  id: string;
  title: string;
  version?: string | null;
  status: PrdStatus;
  overview?: string | null;
  goals?: string | null;
  userStories?: string | null;
  functionalReqs?: string | null;
  nonFunctionalReqs?: string | null;
  userFlows?: string | null;
  assumptions?: string | null;
  platforms?: string | null;
  classification?: PrdClassification | null;
  inScope?: string | null;
  outOfScope?: string | null;
  acceptanceCriteria?: string | null;
  successMetrics?: string | null;
  boardId: string;
  canvasFeatureId?: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  board: { id: string; name: string };
  canvasFeature?: { id: string; text: string } | null;
  personas: PrdPersonaLink[];
  adminBlocks: PrdAdminBlock[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TechComfort = 'low' | 'medium' | 'high';

/**
 * The attributes of a user category. A fixed research template, so two
 * personas answer the same questions and are comparable; only `name` is
 * required, since a persona is filled in as research arrives.
 */
export interface Persona {
  id: string;
  name: string;
  segment?: string | null;
  description?: string | null;
  goals?: string | null;
  painPoints?: string | null;
  behaviours?: string | null;
  techComfort?: TechComfort | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export type InitiativeStatus = 'in_progress' | 'achieved';

/** A ticket raised to fulfil an initiative — title and status only, by design. */
export interface InitiativeTicket {
  id: string;
  title: string;
  status: string;
  column: { board: { id: string; name: string } };
}

/** "A large, coordinated body of work aimed at a specific strategic goal." */
export interface Initiative {
  id: string;
  title: string;
  description: string;
  status: InitiativeStatus;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  tickets: InitiativeTicket[];
}

/** A Riverly Dictionary entry: a workspace-wide term, defined by whoever added it. */
export interface DictionaryTerm {
  id: string;
  term: string;
  definition: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  author: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  ticketId: string;
  dependsOnId: string;
  dependsOn: { id: string; title: string; status: string };
}

/** A ticket from /tickets/assigned, which carries the board it lives on. */
export interface AssignedTicket extends Ticket {
  column: {
    id: string;
    name: string;
    board: { id: string; name: string; type: string };
  };
  sprint?: { id: string; title: string; endDate: string | null } | null;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: string;
  columnId: string;
  assigneeId?: string;
  productManagerId?: string;
  assignedDate?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  type?: string;
  priority?: string;
  project?: string;
  epic?: string;
  flow?: string;
  sprintId?: string;
  productDocId?: string;
  productDoc?: { id: string; title: string; url: string };
  initiativeId?: string;
  initiative?: { id: string; title: string; status: InitiativeStatus };
  prdId?: string | null;
  assignee?: User;
  productManager?: User;
  createdBy: { id: string; name: string };
  _count?: { comments: number };
  dependsOn?: Dependency[];
  dependedOnBy?: { id: string; ticket: { id: string; title: string; status: string } }[];
  comments?: Comment[];
  sprintHistories?: { id: string; sprintId: string; addedAt: string; sprint: { id: string; title: string } }[];
}

export interface Column {
  id: string;
  name: string;
  order: number;
  boardId: string;
  tickets: Ticket[];
}

export interface Board {
  id: string;
  name: string;
  type: string;
  columns: Column[];
  members: { id: string; role: string; user: User }[];
}

export interface Sprint {
  id: string;
  boardId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  status: string;
  _count: { tickets: number; members: number };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  ticketId?: string;
  boardId?: string;
  read: boolean;
  createdAt: string;
}

export interface CanvasFeature {
  id: string;
  blockId: string;
  text: string;
  active: boolean;
  order: number;
}

export interface CanvasBlock {
  id: string;
  projectId: string;
  title: string;
  order: number;
  features: CanvasFeature[];
}

export interface CanvasProject {
  id: string;
  boardId: string;
  name: string;
  order: number;
  blocks: CanvasBlock[];
}

export interface ProductFile {
  id: string;
  boardId: string;
  title: string;
  url: string;
  order: number;
}

export type ChangelogItemKind = 'added' | 'changed' | 'fixed' | 'removed';

export interface ChangelogItem {
  kind: ChangelogItemKind;
  text: string;
}

export interface ChangelogEntry {
  id: string;
  version?: string | null;
  title: string;
  summary?: string | null;
  items: ChangelogItem[];
  boardId?: string | null;
  board?: { id: string; name: string } | null;
  author?: { id: string; name: string } | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** True when the viewer isn't a member of the entry's board — items are withheld. */
  restricted: boolean;
  itemCount: number;
}
