import { createContext } from 'react'

export type RecoveryConfig = {
    address: string;
    accountCode: string;
    guardianEmail: string;
    delay: number; // TODO may need to be bigint
    configured: boolean;
    recovered: boolean;
}

export type RecoveryConfigMap = Record<string, unknown>;

type AppContextTypeV2 = {
    recoveryConfigs: RecoveryConfigMap;
    getRecoveryConfig: (address: string) => RecoveryConfig | undefined;
    setRecoveryConfig: (cfg: RecoveryConfig) => void;
    isModuleEnabled: boolean;
    enableEmailRecoveryModule: () => Promise<void>;
    configureRecoveryAndRequestGuardian: (
        guardianEmail: string, recoveryDelay: number
    ) => Promise<void>;
    requestRecovery: (newOwner: string) => Promise<void>;
    completeRecovery: () => Promise<void>;
}

export const appContextV2 = createContext<AppContextTypeV2>({
    recoveryConfigs: {},
    // TODO Properly type return type, this will be overwritten in provider
    getRecoveryConfig: (_address: string) => { return {} as any; },
    setRecoveryConfig: (_cfg: RecoveryConfig) => {},
    isModuleEnabled: false,
    enableEmailRecoveryModule: async () => {},
    configureRecoveryAndRequestGuardian: async(
        _guardianEmail: string, _recoveryDelay: number
    ) => {},
    requestRecovery: async (_newOwner: string) => {},
    completeRecovery: async () => {},
});
