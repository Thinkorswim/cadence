import React, { useState } from 'react';
import { Trash2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

interface BlockedWebsitesTableProps {
    blockedWebsites: Set<string> | null;
    permissionGranted: boolean;
    onAddWebsite: () => void;
    onDeleteWebsite: (websiteName: string) => void;
    onRequestPermission: () => void;
}

export const BlockedWebsitesTable: React.FC<BlockedWebsitesTableProps> = ({
    blockedWebsites,
    permissionGranted,
    onAddWebsite,
    onDeleteWebsite,
    onRequestPermission,
}) => {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [websiteToDelete, setWebsiteToDelete] = useState<string>('');

    const handleDeleteClick = (website: string) => {
        setWebsiteToDelete(website);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (websiteToDelete) {
            onDeleteWebsite(websiteToDelete);
        }
        setDeleteDialogOpen(false);
        setWebsiteToDelete('');
    };
    if (!permissionGranted) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Blocked Websites</h3>
                </div>

                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Website blocking requires additional permissions to monitor your browsing activity.
                        <div className="mt-3">
                            <Button onClick={onRequestPermission} size="sm">
                                Grant Permission
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between  w-[700px]">
                <h3 className="text-lg font-semibold">Blocked Websites</h3>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                        {blockedWebsites?.size || 0} website{(blockedWebsites?.size || 0) !== 1 ? 's' : ''}
                    </span>
                    <Button onClick={onAddWebsite} size="sm">
                        <Plus className="w-5 h-5 mr-1" />
                        Add Website
                    </Button>
                </div>
            </div>

            <ScrollArea className="w-[700px] rounded-sm border-1 bg-background " viewportClassName="max-h-[296px]">

                <Table >
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-3 font-bold">Website</TableHead>
                            <TableHead className="text-center font-bold w-16 pr-5">Options</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(blockedWebsites === null || blockedWebsites.size === 0) && (
                            <TableRow className="h-52">
                                <TableCell colSpan={2} className="text-center">
                                    No blocked websites to display.
                                </TableCell>
                            </TableRow>
                        )}
                        {blockedWebsites && blockedWebsites.size > 0 && (
                            Array.from(blockedWebsites).map((website) => (
                                <TableRow key={website}>
                                    <TableCell className="font-medium pl-3">{website}</TableCell>
                                    <TableCell className="flex justify-center items-center space-x-2 w-16">
                                        <Trash2
                                            className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-700"
                                            onClick={() => handleDeleteClick(website)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
            
            {blockedWebsites && blockedWebsites.size > 0 && (
                <div className="text-xs text-muted-foreground">
                    These websites will be blocked when you're in an active focus session.
                    You'll be redirected to a motivational page instead.
                </div>
            )}

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-background w-[370px]">
                    <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md'>
                        <DialogTitle>Delete Blocked Website</DialogTitle>
                        <DialogDescription>
                            <div className="mb-3 mt-6">
                                <p className="text-foreground">
                                    Are you sure you want to remove <strong>"{websiteToDelete}"</strong> from your blocked websites list?
                                </p>
                            </div>

                            <div className='w-full flex justify-end gap-2 mb-2'>
                                <Button
                                    variant="outline"
                                    onClick={() => setDeleteDialogOpen(false)}
                                    className="mt-5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={confirmDelete}
                                    className="mt-5"
                                >
                                    Delete Website
                                </Button>
                            </div>
                        </DialogDescription>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
