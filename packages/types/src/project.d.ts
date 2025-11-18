import { z } from 'zod';
export declare const ProjectStatusSchema: z.ZodEnum<{
    planning: "planning";
    in_progress: "in_progress";
    completed: "completed";
    archived: "archived";
}>;
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    professionalId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        planning: "planning";
        in_progress: "in_progress";
        completed: "completed";
        archived: "archived";
    }>;
    budget: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const ProjectMilestoneSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodDate>;
    completed: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const IdeaBookItemSchema: z.ZodObject<{
    type: z.ZodEnum<{
        professional: "professional";
        image: "image";
        product: "product";
        note: "note";
    }>;
    url: z.ZodOptional<z.ZodString>;
    referenceId: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const IdeaBookSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            professional: "professional";
            image: "image";
            product: "product";
            note: "note";
        }>;
        url: z.ZodOptional<z.ZodString>;
        referenceId: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    sharedWith: z.ZodOptional<z.ZodArray<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectMilestone = z.infer<typeof ProjectMilestoneSchema>;
export type IdeaBook = z.infer<typeof IdeaBookSchema>;
export type IdeaBookItem = z.infer<typeof IdeaBookItemSchema>;
//# sourceMappingURL=project.d.ts.map