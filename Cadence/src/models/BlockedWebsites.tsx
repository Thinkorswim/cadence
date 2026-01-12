export class BlockedWebsites {
  constructor(
    public websites: Set<string> = new Set(),
    public enabled: boolean = false
  ) {}

  // Add a website to the blocked list
  addWebsite(website: string): void {
    this.websites.add(website);
  }

  // Remove a website from the blocked list
  removeWebsite(website: string): void {
    this.websites.delete(website);
  }

  // Check if a website is blocked (supports subdomain matching and www normalization)
  isWebsiteBlocked(hostname: string): boolean {
    // Normalize hostname by removing www. prefix
    const normalizeHostname = (host: string): string => {
      return host.startsWith('www.') ? host.slice(4) : host;
    };

    const normalizedHostname = normalizeHostname(hostname);
    
    // Check exact match with normalized hostname
    if (this.websites.has(normalizedHostname)) return true;
    
    // Also check if the original hostname (with www) is in the set
    if (this.websites.has(hostname)) return true;
    
    // Check if any blocked website is a parent domain of the current hostname
    for (const blockedSite of this.websites) {
      const normalizedBlockedSite = normalizeHostname(blockedSite);
      
      // Subdomain match with normalized domains
      if (normalizedHostname.endsWith('.' + normalizedBlockedSite)) return true;
      
      // Also check original blocked site format
      if (normalizedHostname.endsWith('.' + blockedSite)) return true;
    }
    
    return false;
  }

  // Get all blocked websites as array
  getWebsitesArray(): string[] {
    return Array.from(this.websites);
  }

  // Serialize instance to plain object
  toJSON(): {
    websites: string[];
    enabled: boolean;
  } {
    return {
      websites: Array.from(this.websites),
      enabled: this.enabled,
    };
  }

  // Deserialize plain object to class instance
  static fromJSON(json: {
    websites?: string[];
    enabled?: boolean;
  }): BlockedWebsites {
    const websites = new Set(json.websites || []);
    return new BlockedWebsites(
      websites,
      json.enabled || false
    );
  }
}
