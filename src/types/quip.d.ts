declare module 'quip' {
  export class QuipClient {
    constructor(options: { accessToken: string; baseUrl?: string });
    getThread(threadId: string): Promise<any>;
    editDocument(threadId: string, content: string, format: string, operation: string): Promise<any>;
    newDocument(content: string, options: { title: string; format: string; folderIds?: string[] }): Promise<any>;
    getAuthenticatedUser(): Promise<any>;
    APPEND: string;
    PREPEND: string;
    REPLACE: string;
  }
}
