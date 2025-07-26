import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Info, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { generateColorFromString } from "@/lib/utils";
import { useState } from "react";

type ProjectsTableProps = {
    projects: Array<{ name: string }> | null;
    selectedProject: string;
    addProject: () => void;
    deleteProject: (projectDetails: { name: string }) => void;
};

export const ProjectsTable: React.FC<ProjectsTableProps> = ({ projects, selectedProject, addProject, deleteProject }) => {
    // Calculate height based on number of projects (each row is roughly 40px + some padding)
    const projectCount = projects?.length || 0;
    // const calculatedHeight = Math.min(220, Math.max(38  , projectCount * 38 - projectCount)); // Min 37px, max 220px

    // State for confirmation dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

    const handleDeleteClick = (projectName: string) => {
        setProjectToDelete(projectName);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (projectToDelete) {
            deleteProject({ name: projectToDelete });
        }
        setIsDeleteDialogOpen(false);
        setProjectToDelete(null);
    };

    const handleCancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setProjectToDelete(null);
    };

    return (
        <>
            <div className="flex items-center justify-between w-[600px] mb-4">
                <div className="flex items-center">
                    <Label className='text-base'>Projects</Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button className="flex items-center justify-center ml-2 rounded-full">
                                    <Info className="w-4 h-4 text-secondary" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-secondary text-white p-2 rounded">
                                Projects help you categorize your sessions.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <Button className="rounded-sm text-background bg-primary h-7 px-3" onClick={addProject}> <Plus className='h-4 w-4' /> Add Project </Button>
            </div>
            <ScrollArea className="w-[600px] rounded-sm border-1 bg-background " viewportClassName="max-h-[220px]">
                <Table>
                    <TableBody>
                        {(projects === null || projects.length === 0) && (
                            <TableRow className="h-52">
                                <TableCell colSpan={7} className="text-center">No projects to show.</TableCell>
                            </TableRow>
                        )}
                        {projects && projects.length >= 0 && (
                            projects.map(({ name }) => (
                                <TableRow key={name} className="hover:bg-secondary/5">
                                    <TableCell className="pl-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: generateColorFromString(name) }}
                                            />
                                            <span>{name}</span>
                                            {name === selectedProject && (
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="w-16 pr-5">
                                        <div className="flex justify-center items-center">
                                            {name !== 'General' && (
                                                <Trash2
                                                    className="w-5 h-5 text-primary cursor-pointer"
                                                    onClick={() => handleDeleteClick(name)}
                                                />
                                            )}
                                            {name === 'General' && (
                                                <span className="text-sm text-muted-foreground">Protected</span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="bg-background w-[370px]">
                    <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md'>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>
                            <div className="mb-3 mt-6">
                                <p className="text-foreground">
                                    Are you sure you want to delete the project <strong>"{projectToDelete}"</strong>?
                                </p>
                            </div>

                            <div className='w-full flex justify-end gap-2 mb-2'>
                                <Button
                                    variant="outline"
                                    onClick={handleCancelDelete}
                                    className="mt-5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleConfirmDelete}
                                    className="mt-5"
                                >
                                    Delete Project
                                </Button>
                            </div>
                        </DialogDescription>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
