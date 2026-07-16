import {
    getAllEditor,
    getFrontend,
    Plugin,
    Setting,
} from "siyuan";
import {EditorController} from "./controller";
import {isProtyleSupported} from "./renderer";
import {
    HeadingNumberService,
    isAbortError,
} from "./service";
import {transactionMayChangeHeadingNumbers} from "./transactions";
import type {
    MinimalProtyle,
    PluginSettings,
    Transaction,
    TransactionOperation,
    WebSocketPayload,
} from "./types";
import "./index.scss";

const SETTINGS_FILE = "settings.json";
const REFRESH_DELAY = 300;
const SUPPORTED_FRONTENDS = new Set(["desktop", "browser-desktop", "desktop-window"]);

export default class FloatingHeadingNumberPlugin extends Plugin {
    private readonly service = new HeadingNumberService();
    private readonly controllers = new Map<HTMLElement, EditorController>();
    private readonly refreshTimers = new Map<string, number>();
    private readonly loggedFailures = new Set<string>();
    private settingsValue: PluginSettings = {enabled: true};
    private runtimeSupported = false;
    private appearanceObserver?: MutationObserver;
    private settingInput?: HTMLInputElement;

    private readonly onStatic = (event: CustomEvent): void => {
        const controller = this.attach(extractEventProtyle(event));
        if (controller) {
            this.loadController(controller);
        }
    };

    private readonly onDynamic = (event: CustomEvent): void => {
        const controller = this.attach(extractEventProtyle(event));
        if (!controller?.rootId) {
            return;
        }
        const snapshot = this.service.peek(controller.rootId);
        if (snapshot) {
            controller.applySnapshot(snapshot);
        } else {
            this.loadController(controller);
        }
    };

    private readonly onSwitch = (event: CustomEvent): void => {
        const controller = this.attach(extractEventProtyle(event));
        if (controller) {
            this.loadController(controller);
        }
    };

    private readonly onDestroy = (event: CustomEvent): void => {
        const protyle = extractEventProtyle(event);
        if (protyle) {
            this.detach(protyle.element);
        }
    };

    private readonly onWebSocket = (event: CustomEvent): void => {
        const payload = event.detail as WebSocketPayload | undefined;
        if (!payload) {
            return;
        }
        if (["setAppearance", "setConf", "setTheme", "setUILayout"].includes(payload.cmd ?? "")) {
            this.renderAll();
        }
        if (payload.cmd === "transactions") {
            this.handleTransactions(payload);
        }
    };

    async onload(): Promise<void> {
        this.runtimeSupported = SUPPORTED_FRONTENDS.has(getFrontend());
        await this.loadSettings();
        this.configureSettings();
        if (!this.runtimeSupported) {
            return;
        }

        this.eventBus.on("loaded-protyle-static", this.onStatic);
        this.eventBus.on("loaded-protyle-dynamic", this.onDynamic);
        this.eventBus.on("switch-protyle", this.onSwitch);
        this.eventBus.on("destroy-protyle", this.onDestroy);
        this.eventBus.on("ws-main", this.onWebSocket);
        this.observeAppearance();
    }

    onLayoutReady(): void {
        if (!this.runtimeSupported) {
            return;
        }
        getAllEditor().forEach((candidate) => {
            const controller = this.attach(normalizeProtyle(candidate));
            if (controller) {
                this.loadController(controller);
            }
        });
    }

    onunload(): void {
        if (this.runtimeSupported) {
            this.eventBus.off("loaded-protyle-static", this.onStatic);
            this.eventBus.off("loaded-protyle-dynamic", this.onDynamic);
            this.eventBus.off("switch-protyle", this.onSwitch);
            this.eventBus.off("destroy-protyle", this.onDestroy);
            this.eventBus.off("ws-main", this.onWebSocket);
        }
        this.appearanceObserver?.disconnect();
        this.refreshTimers.forEach((timer) => window.clearTimeout(timer));
        this.refreshTimers.clear();
        this.controllers.forEach((controller) => {
            if (controller.rootId) {
                this.service.release(controller.rootId);
            }
            controller.destroy();
        });
        this.controllers.clear();
        this.service.dispose();
    }

    async uninstall(): Promise<void> {
        try {
            await this.removeData(SETTINGS_FILE);
        } catch (error) {
            console.warn(`[${this.name}] failed to remove ${SETTINGS_FILE}`, error);
        }
    }

    async onDataChanged(): Promise<void> {
        await this.loadSettings();
        if (this.settingInput) {
            this.settingInput.checked = this.settingsValue.enabled;
        }
        this.applySettings();
    }

    private async loadSettings(): Promise<void> {
        try {
            const stored = await this.loadData(SETTINGS_FILE);
            this.settingsValue = {
                enabled: isRecord(stored) && typeof stored.enabled === "boolean" ? stored.enabled : true,
            };
        } catch (error) {
            console.warn(`[${this.name}] failed to load ${SETTINGS_FILE}`, error);
            this.settingsValue = {enabled: true};
        }
    }

    private configureSettings(): void {
        this.setting = new Setting({
            confirmCallback: () => {
                const enabled = this.settingInput?.checked ?? true;
                this.settingsValue = {enabled};
                this.applySettings();
                void this.saveData(SETTINGS_FILE, this.settingsValue).catch((error) => {
                    console.warn(`[${this.name}] failed to save ${SETTINGS_FILE}`, error);
                });
            },
        });
        this.setting.addItem({
            title: this.i18n.enabledTitle,
            description: this.i18n.enabledDescription,
            direction: "column",
            createActionElement: () => {
                const input = document.createElement("input");
                input.type = "checkbox";
                input.className = "b3-switch";
                input.checked = this.settingsValue.enabled;
                this.settingInput = input;
                return input;
            },
        });
    }

    private applySettings(): void {
        if (!this.settingsValue.enabled) {
            this.refreshTimers.forEach((timer) => window.clearTimeout(timer));
            this.refreshTimers.clear();
            new Set(Array.from(this.controllers.values()).map((controller) => controller.rootId).filter(Boolean))
                .forEach((rootId) => this.service.clear(rootId as string));
            this.controllers.forEach((controller) => controller.setEnabled(false));
            return;
        }

        this.controllers.forEach((controller) => {
            controller.setEnabled(true);
            this.loadController(controller);
        });
    }

    private attach(protyle?: MinimalProtyle): EditorController | undefined {
        if (!protyle?.element || !protyle.wysiwyg?.element) {
            return undefined;
        }

        let controller = this.controllers.get(protyle.element);
        if (!controller) {
            controller = new EditorController(protyle, this.settingsValue.enabled);
            this.controllers.set(protyle.element, controller);
        } else {
            controller.updateProtyle(protyle);
        }

        const oldRootId = controller.rootId;
        const nextRootId = isProtyleSupported(protyle) ? protyle.block.rootID : undefined;
        if (oldRootId !== nextRootId) {
            if (oldRootId) {
                this.service.release(oldRootId);
            }
            controller.switchRoot(nextRootId);
            if (nextRootId) {
                this.service.retain(nextRootId);
            }
        }
        if (!nextRootId) {
            controller.clearSnapshot();
        }
        return controller;
    }

    private detach(host: HTMLElement): void {
        const controller = this.controllers.get(host);
        if (!controller) {
            return;
        }
        if (controller.rootId) {
            this.service.release(controller.rootId);
        }
        controller.destroy();
        this.controllers.delete(host);
    }

    private loadController(controller: EditorController): void {
        if (!this.settingsValue.enabled || !controller.rootId) {
            controller.clearSnapshot();
            return;
        }
        const rootId = controller.rootId;
        const cached = this.service.peek(rootId);
        if (cached) {
            controller.applySnapshot(cached);
        }
        const token = controller.beginRequest();
        if (!token) {
            return;
        }
        void this.service.get(rootId).then((snapshot) => {
            this.loggedFailures.delete(rootId);
            controller.applySnapshot(snapshot, token);
        }).catch((error: unknown) => {
            if (!isAbortError(error) && !token.signal.aborted) {
                this.handleLoadError(rootId, error);
            }
        });
    }

    private handleTransactions(payload: WebSocketPayload): void {
        if (!this.settingsValue.enabled) {
            return;
        }
        const openRoots = this.openRootIds();
        if (openRoots.size === 0) {
            return;
        }

        const contextRoots = Array.isArray(payload.context?.rootIDs) &&
                payload.context.rootIDs.every((rootId) => typeof rootId === "string") ?
            payload.context.rootIDs as string[] :
            undefined;
        const affectedRoots = contextRoots?.length ?
            contextRoots.filter((rootId) => openRoots.has(rootId)) :
            Array.from(openRoots);
        if (affectedRoots.length === 0) {
            return;
        }

        const {operations, incomplete} = extractOperations(payload.data);
        const shouldRefresh = transactionMayChangeHeadingNumbers({
            operations,
            snapshots: affectedRoots.map((rootId) => this.service.peek(rootId)),
            incomplete: incomplete || !contextRoots?.length,
            affectedRootCount: contextRoots?.length ?? affectedRoots.length,
        });
        if (shouldRefresh) {
            affectedRoots.forEach((rootId) => this.scheduleRefresh(rootId));
        }
    }

    private scheduleRefresh(rootId: string): void {
        const previous = this.refreshTimers.get(rootId);
        if (previous !== undefined) {
            window.clearTimeout(previous);
        }
        this.refreshTimers.set(
            rootId,
            window.setTimeout(() => {
                this.refreshTimers.delete(rootId);
                this.refreshRoot(rootId);
            }, REFRESH_DELAY),
        );
    }

    private refreshRoot(rootId: string): void {
        const controllers = this.controllersForRoot(rootId);
        if (controllers.length === 0 || !this.settingsValue.enabled) {
            return;
        }
        const tokens = new Map<EditorController, ReturnType<EditorController["beginRequest"]>>();
        controllers.forEach((controller) => tokens.set(controller, controller.beginRequest()));
        void this.service.refresh(rootId).then((snapshot) => {
            this.loggedFailures.delete(rootId);
            controllers.forEach((controller) => {
                const token = tokens.get(controller);
                if (token) {
                    controller.applySnapshot(snapshot, token);
                }
            });
        }).catch((error: unknown) => {
            if (!isAbortError(error)) {
                this.handleLoadError(rootId, error);
            }
        });
    }

    private handleLoadError(rootId: string, error: unknown): void {
        this.service.clear(rootId);
        this.controllersForRoot(rootId).forEach((controller) => controller.clearSnapshot());
        if (!this.loggedFailures.has(rootId)) {
            this.loggedFailures.add(rootId);
            console.warn(`[${this.name}] ${this.i18n.loadError} [${rootId}]`, error);
        }
    }

    private controllersForRoot(rootId: string): EditorController[] {
        return Array.from(this.controllers.values()).filter((controller) => controller.rootId === rootId);
    }

    private openRootIds(): Set<string> {
        return new Set(
            Array.from(this.controllers.values())
                .map((controller) => controller.rootId)
                .filter((rootId): rootId is string => !!rootId),
        );
    }

    private renderAll(): void {
        this.controllers.forEach((controller) => controller.requestRender());
    }

    private observeAppearance(): void {
        this.appearanceObserver = new MutationObserver(() => this.renderAll());
        this.appearanceObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"],
        });
        if (document.body) {
            this.appearanceObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ["class", "style"],
            });
        }
        if (document.head) {
            this.appearanceObserver.observe(document.head, {childList: true});
        }
    }
}

function normalizeProtyle(candidate: unknown): MinimalProtyle | undefined {
    if (!candidate || typeof candidate !== "object") {
        return undefined;
    }
    const value = candidate as {protyle?: unknown; element?: unknown;};
    const protyle = value.protyle && typeof value.protyle === "object" ? value.protyle : candidate;
    const typed = protyle as Partial<MinimalProtyle>;
    return typed.element instanceof HTMLElement && typed.wysiwyg?.element instanceof HTMLElement ?
        typed as MinimalProtyle :
        undefined;
}

function extractEventProtyle(event: CustomEvent): MinimalProtyle | undefined {
    const detail = event.detail as {protyle?: unknown;} | undefined;
    return normalizeProtyle(detail?.protyle);
}

function extractOperations(data: unknown): {operations: TransactionOperation[]; incomplete: boolean;} {
    if (!Array.isArray(data) || data.length === 0) {
        return {operations: [], incomplete: true};
    }
    const operations: TransactionOperation[] = [];
    for (const value of data) {
        const transaction = value as Transaction;
        if (!transaction || !Array.isArray(transaction.doOperations)) {
            return {operations, incomplete: true};
        }
        operations.push(...transaction.doOperations);
    }
    return {operations, incomplete: false};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
