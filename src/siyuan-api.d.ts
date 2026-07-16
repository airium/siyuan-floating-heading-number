declare module "siyuan" {
    interface EventBus {
        on(type: string, listener: (event: CustomEvent) => void): void;
        off(type: string, listener: (event: CustomEvent) => void): void;
    }

    interface SettingItem {
        title: string;
        description?: string;
        direction?: "row" | "column";
        createActionElement?: () => HTMLElement;
        actionElement?: HTMLElement;
    }

    export class Setting {
        constructor(options: {
            confirmCallback?: () => void;
            destroyCallback?: () => void;
            width?: string;
            height?: string;
        });

        addItem(options: SettingItem): void;
    }

    export class Plugin {
        readonly name: string;
        i18n: Record<string, string>;
        data: Record<string, unknown>;
        eventBus: EventBus;
        setting: Setting;

        loadData(storageName: string): Promise<unknown>;
        saveData(storageName: string, data: unknown): Promise<unknown>;
        removeData(storageName: string): Promise<unknown>;
    }

    export function getAllEditor(): unknown[];
    export function getFrontend(): string;
}
