export interface PluginSettings {
    enabled: boolean;
}

export interface BlockDOMResponse {
    code: number;
    data: {
        id: string;
        dom: string;
    };
    msg?: string;
}

export interface HeadingSnapshot {
    rootId: string;
    numberById: ReadonlyMap<string, string>;
    levelById: ReadonlyMap<string, number>;
    allHeadingIds: ReadonlySet<string>;
    headingAncestorIds: ReadonlySet<string>;
    minimumLevel: number | null;
}

export interface MinimalProtyle {
    id: string;
    element: HTMLElement;
    block: {
        rootID?: string;
    };
    options: {
        action?: string[];
        backlinkData?: unknown;
        history?: unknown;
    };
    wysiwyg: {
        element: HTMLElement;
    };
    gutter?: {
        element: HTMLElement;
    };
    contentElement?: HTMLElement;
}

export interface TransactionOperation {
    action?: string;
    id?: string;
    blockID?: string;
    parentID?: string;
    previousID?: string;
    data?: unknown;
    retData?: unknown;
}

export interface Transaction {
    doOperations?: TransactionOperation[];
    undoOperations?: TransactionOperation[];
}

export interface WebSocketPayload {
    cmd?: string;
    data?: unknown;
    context?: {
        rootIDs?: unknown;
        isUndoReplay?: boolean;
    };
}

export interface ControllerRequestToken {
    generation: number;
    rootId: string;
    signal: AbortSignal;
}
