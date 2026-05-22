export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
  project?: string;
  epic?: string;
  sprintId?: string;
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
