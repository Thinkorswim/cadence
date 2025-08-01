import React, { useState } from 'react';
import { CompletedSession } from '../models/CompletedSession';
import { HistoricalStats } from '../models/HistoricalStats';
import { timeDisplayFormatBadge, generateColorFromString } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type SessionsTableProps = {
    historicalStats: HistoricalStats;
    deleteSession: (date: string, sessionIndex: number) => void;
    editSession: (date: string, sessionIndex: number) => void;
    addSession: () => void;
};

export const SessionsTable: React.FC<SessionsTableProps> = ({
    historicalStats,
    deleteSession,
    editSession,
    addSession
}) => {

    const [currentPage, setCurrentPage] = useState(0);
    const sessionsPerPage = 15;

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<{ date: string; index: number } | null>(null);

    const truncateText = (text: string, maxLength: number = 40): string => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const formatDateOnly = (date: Date): string => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    };

    const formatTimeOnly = (date: Date): string => {
        // Use the user's locale preferences, falling back to language, then system default
        const userLocale = navigator.languages?.[0] || navigator.language || undefined;
        const formatter = new Intl.DateTimeFormat(userLocale, {
            hour: '2-digit',
            minute: '2-digit'
        });
        return formatter.format(date);
    };

    // Get all sessions from historical stats and flatten them with their dates
    const getAllSessions = (): Array<{ session: CompletedSession; date: string; sessionIndex: number }> => {
        const allSessions: Array<{ session: CompletedSession; date: string; sessionIndex: number }> = [];

        Object.entries(historicalStats.stats).forEach(([date, sessions]) => {
            sessions.forEach((session, index) => {
                allSessions.push({ session, date, sessionIndex: index });
            });
        });

        // Sort by timeEnded, most recent first
        return allSessions.sort((a, b) =>
            new Date(b.session.timeEnded).getTime() - new Date(a.session.timeEnded).getTime()
        );
    };

    const allSessions = getAllSessions();
    const totalPages = Math.ceil(allSessions.length / sessionsPerPage);
    const startIndex = currentPage * sessionsPerPage;
    const endIndex = startIndex + sessionsPerPage;
    const currentSessions = allSessions.slice(startIndex, endIndex);

    const goToNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleDeleteClick = (date: string, sessionIndex: number) => {
        setSessionToDelete({ date, index: sessionIndex });
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (sessionToDelete) {
            deleteSession(sessionToDelete.date, sessionToDelete.index);
        }
        setIsDeleteDialogOpen(false);
        setSessionToDelete(null);
    };

    const handleCancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setSessionToDelete(null);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Recent Sessions</h3>
                <Button onClick={addSession} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Session
                </Button>
            </div>

            <Table className='bg-background rounded-md'>
                <TableHeader>
                    <TableRow >
                        <TableHead className="pl-5 font-bold">Date</TableHead>
                        <TableHead className="font-bold">Time Completed</TableHead>
                        <TableHead className="font-bold">Project</TableHead>
                        <TableHead className=" font-bold">Duration</TableHead>
                        <TableHead className="text-center font-bold">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentSessions.length === 0 && (
                        <TableRow className="h-52">
                            <TableCell colSpan={5} className="text-center">
                                No completed sessions to display. Complete some focus sessions to see them here!
                            </TableCell>
                        </TableRow>
                    )}
                    {currentSessions.map(({ session, date, sessionIndex }, index) => (
                        <TableRow key={`${date}-${sessionIndex}`} className="hover:bg-secondary/5">
                            <TableCell className="font-medium pl-5">
                                {formatDateOnly(session.timeEnded)}
                            </TableCell>
                            <TableCell>{formatTimeOnly(session.timeEnded)}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: generateColorFromString(session.project) }}
                                    />
                                    <span title={session.project}>
                                        {truncateText(session.project)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>{timeDisplayFormatBadge(session.totalTime)}</TableCell>
                            <TableCell className="flex justify-center items-center space-x-2">
                                <Pencil
                                    className="w-5 h-5 text-primary cursor-pointer hover:text-primary/80"
                                    onClick={() => editSession(date, sessionIndex)}
                                />
                                <Trash2
                                    className="w-5 h-5 text-primary cursor-pointer hover:text-primary/80"
                                    onClick={() => handleDeleteClick(date, sessionIndex)}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, allSessions.length)} of {allSessions.length} sessions
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages - 1}
                            className="flex items-center gap-1 bg-background hover:bg-secondary/30 text-foreground"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage + 1} of {totalPages}
                        </span>
                        <Button
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 0}
                            className="flex items-center gap-1 bg-background hover:bg-secondary/30 text-foreground"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={handleCancelDelete}>
                <DialogContent className="bg-background w-[350px]">
                    <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md'>
                        <DialogTitle>Delete Session</DialogTitle>
                        <DialogDescription>
                            <div className="mt-4 mb-6">
                                <p>Are you sure you want to delete this session? This action cannot be undone.</p>
                            </div>
                            <div className='flex justify-end gap-2'>
                                <Button variant="outline" onClick={handleCancelDelete}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleConfirmDelete}>
                                    Delete
                                </Button>
                            </div>
                        </DialogDescription>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
