import { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react";
import { Button } from '@/components/ui/button';
import { validateURL, extractHostnameAndDomain } from '@/lib/utils';
import { BlockedWebsites } from '@/models/BlockedWebsites';
import { syncAddBlockedWebsite } from '@/lib/sync';
import { User } from '@/models/User';
import { loadUserFromStorage } from '@/lib/auth';

interface BlockedWebsiteFormProps {
    callback?: () => void; // Generic optional callback
}

export const BlockedWebsiteForm: React.FC<BlockedWebsiteFormProps> = ({ callback }) => {
    const [websiteValue, setWebsiteValue] = useState("");
    const [isValidWebsite, setIsValidWebsite] = useState(true);
    const [user, setUser] = useState<User>(new User());

    const websiteInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            const loadedUser = await loadUserFromStorage();
            if (loadedUser) {
                setUser(loadedUser);
            }
        };
        loadUser();
    }, []);

    // Add the blocked website to storage
    const addBlockedWebsite = () => {
        let realUrl: string | null = null;

        // Check if it's a full URL
        if (websiteValue.startsWith('http://') || websiteValue.startsWith('https://')) {
            try {
                // Extract hostname from the full URL (handles paths, query params, etc.)
                realUrl = extractHostnameAndDomain(websiteValue);
                if (!realUrl) {
                    setIsValidWebsite(false);
                    websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    websiteInputRef.current?.focus();
                    return;
                }
            } catch (error) {
                setIsValidWebsite(false);
                websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                websiteInputRef.current?.focus();
                return;
            }
        } else {
            // It's just a hostname, validate it's not empty and doesn't contain invalid chars
            const trimmedValue = websiteValue.trim();
            if (!trimmedValue || !/^(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedValue)) {
                setIsValidWebsite(false);
                websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                websiteInputRef.current?.focus();
                return;
            }
            realUrl = trimmedValue;
        }

        // Normalize the URL by removing www. prefix for consistency
        if (realUrl && realUrl.startsWith('www.')) {
            realUrl = realUrl.slice(4);
        }

        if (realUrl) {
            browser.storage.local.get(['blockedWebsites'], (data) => {
                const blockedWebsites = BlockedWebsites.fromJSON(data.blockedWebsites || {});
                
                // Check if website already exists
                if (blockedWebsites.isWebsiteBlocked(realUrl!)) {
                    setIsValidWebsite(false);
                    websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    websiteInputRef.current?.focus();
                    return;
                }

                blockedWebsites.addWebsite(realUrl!);

                browser.storage.local.set({ blockedWebsites: blockedWebsites.toJSON() }, () => {
                    // Sync to backend if Pro user
                    if (user.isPro) syncAddBlockedWebsite(realUrl!);
                    
                    // Close the dialog
                    if (callback) {
                        callback();
                    }
                });
            });
        } else {
            setIsValidWebsite(false);
            websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            websiteInputRef.current?.focus();
            return;
        }
    };

    return (
        <div className="w-[99%] mx-auto">
            <div className="mt-5">
                <div className="mt-5 flex items-center">
                    <Label htmlFor="websiteName">Website</Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full">
                                    <Info className="w-4 h-4 text-secondary" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-secondary text-white p-2 rounded">
                                Enter a website domain (e.g. youtube.com) or paste a full URL. The domain will be extracted automatically.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Input
                    ref={websiteInputRef}
                    className='mt-2'
                    id="websiteName"
                    value={websiteValue}
                    placeholder="Enter website or paste URL (e.g. youtube.com)"
                    onChange={(e) => {
                        setWebsiteValue(e.target.value);
                        setIsValidWebsite(true); // Reset validation on change
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addBlockedWebsite();
                        }
                    }}
                />
                {!isValidWebsite && (
                    <p className="text-red-500 text-sm mt-2">
                        {websiteValue.trim() === '' 
                            ? 'Please enter a website'
                            : 'Invalid website format or website already exists'
                        }
                    </p>
                )}
            </div>

            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addBlockedWebsite}>Add Website</Button>
            </div>
        </div>
    );
};
