export type GoalStatus = "todo" | "doing" | "done";
export type GoalPriority = "low" | "medium" | "high";

export type Goal = {
  id: string;
  ownerId: string | null;
  parentId: string | null;
  slot: number;
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  dueDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
