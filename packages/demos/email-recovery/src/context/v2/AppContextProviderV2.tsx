import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { RecoveryConfig, RecoveryConfigMap, appContextV2 } from "./AppContextV2";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { safeZkSafeZkEmailRecoveryPlugin } from '../../../contracts.base-sepolia.json'
import { abi as safeAbi } from '../../abi/Safe.json'
import { abi as recoveryPluginAbi } from '../../abi/SafeZkEmailRecoveryPlugin.json'
import { genAccountCode, getRequestGuardianSubject, getRequestsRecoverySubject, templateIdx } from "../../utils/email";
import { readContract } from 'wagmi/actions';
import { config } from '../../providers/config';
import { relayer } from "../../services/relayer";
import { pad } from "viem";

// TOOD Use lib type
type HexStr = `0x${string}`;

const appContextLocalStorageKey = "appContextV2";

export const AppContextProviderV2 = ({ children } : { children: ReactNode }) => {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const [recoveryConfigs, setRecoveryConfigs] = useState<RecoveryConfigMap>({});

    const getRecoveryConfig = useCallback((address: string) => {
        return recoveryConfigs[address] as RecoveryConfig | undefined;
    }, [recoveryConfigs]);

    const setRecoveryConfig = useCallback((cfg: RecoveryConfig) => {
        const updatedConfigs = {
            ...recoveryConfigs,
            [cfg.address]: cfg,
        };

        setRecoveryConfigs(updatedConfigs);
        localStorage.setItem(appContextLocalStorageKey, JSON.stringify(updatedConfigs));
    }, []);

    const { data: isModuleEnabled } = useReadContract({
        address,
        abi: safeAbi,
        functionName: 'isModuleEnabled',
        args: [safeZkSafeZkEmailRecoveryPlugin]
    });

    const { data: safeOwnersData } = useReadContract({
        address,
        abi: safeAbi,
        functionName: 'getOwners',
    });

    const { data: recoveryRouterAddr } = useReadContract({
        abi: recoveryPluginAbi,
        address: safeZkSafeZkEmailRecoveryPlugin as HexStr,
        functionName: 'getRouterForSafe',
        args: [address]
    });

    const firstSafeOwner = useMemo(() => {
        const safeOwners = safeOwnersData as string[];
        if (!safeOwners?.length) {
            return;
        }
        return safeOwners[0];
    }, [safeOwnersData]);

    // const checkGuardianAcceptance = useCallback(async () => {
    //     if (!gurdianRequestId) {
    //         throw new Error('missing guardian request id')
    //     }

    //     const resBody = await relayer.requestStatus(gurdianRequestId)
    //     console.debug('guardian req res body', resBody);
    // }, [gurdianRequestId])

    const enableEmailRecoveryModule = useCallback(async () => {
        if (!address) {
            throw new Error('unable to get account address');
        }

        if (isModuleEnabled) {
            throw new Error('module is already enabled')
        }

        await writeContractAsync({
            abi: safeAbi,
            address,
            functionName: 'enableModule',
            args: [safeZkSafeZkEmailRecoveryPlugin],
         })
    }, [address, writeContractAsync, isModuleEnabled])

    const configureRecoveryAndRequestGuardian = useCallback(async (
        guardianEmail: string, recoveryDelay: number
    ) => {
        if (!address) {
            throw new Error('unable to get account address');
        }

        if (!guardianEmail) {
            throw new Error('guardian email not set')
        }

        if (!firstSafeOwner) {
            throw new Error('safe owner not found')
        }

        const accountCode = await genAccountCode()

        const guardianSalt = await relayer.getAccountSalt(accountCode, guardianEmail);
        const guardianAddr = await readContract(config, {
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as HexStr,
            functionName: 'computeEmailAuthAddress',
            args: [guardianSalt]
        })
        // TODO Should this be something else?
        const previousOwnerInLinkedList = pad("0x1", {
            size: 20
        })

        await writeContractAsync({
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as HexStr,
            functionName: 'configureRecovery',
            args: [
                firstSafeOwner,
                guardianAddr,
                recoveryDelay,
                previousOwnerInLinkedList
            ],
         })

         console.debug('recovery configured');

         setRecoveryConfig({
            address,
            accountCode,
            guardianEmail,
            delay: recoveryDelay,
            configured: true,
            recovered: false,
         });

         const recoveryRouterAddr = await readContract(config, {
            abi: recoveryPluginAbi,
            address: safeZkSafeZkEmailRecoveryPlugin as HexStr,
            functionName: 'getRouterForSafe',
            args: [address]
        }) as string;

        const subject = getRequestGuardianSubject(address);
        const { requestId } = await relayer.acceptanceRequest(
            recoveryRouterAddr,
            guardianEmail,
            accountCode,
            templateIdx,
            subject,
        );

        console.debug('req guard req id', requestId)
        // TODO poll until guard req is complete or fails
    }, [
        address,
        firstSafeOwner,
        writeContractAsync
    ])

    const requestRecovery = useCallback(async (newOwner: string) => {
        // TODO Better type interface for key lookup
        const recoveryCfg = getRecoveryConfig(address || '');
        if (!recoveryCfg) {
            throw new Error('recvoery not configured');
        }

        if (!address) {
            throw new Error('unable to get account address');
        }

        if (!recoveryRouterAddr) {
            throw new Error('could not find recovery router for safe')
        }

        const subject = getRequestsRecoverySubject(address, newOwner)

        const { requestId } = await relayer.recoveryRequest(
            recoveryRouterAddr as string,
            recoveryCfg.guardianEmail,
            templateIdx,
            subject,
        )
        console.debug('recovery request id', requestId)
        // TODO poll until recovery req is complete or fails
    }, [recoveryRouterAddr, address])

    const completeRecovery = useCallback(async () => {
        if (!recoveryRouterAddr) {
            throw new Error('could not find recovery router for safe')
        }

        console.debug('recovery router addr', recoveryRouterAddr);
        const res = relayer.completeRecovery(
            recoveryRouterAddr as string
        );

        console.debug('complete recovery res', res)
    }, [recoveryRouterAddr]);

    useEffect(() => {
        const loadedRecoveryCfgsStr = localStorage.getItem(appContextLocalStorageKey);
        const cfgs = loadedRecoveryCfgsStr ?
            JSON.parse(loadedRecoveryCfgsStr) :
            {};

        setRecoveryConfigs(cfgs);
    });
    
    const ctxVal = useMemo(() => ({
        recoveryConfigs,
        getRecoveryConfig,
        setRecoveryConfig,
        isModuleEnabled: !!isModuleEnabled,
        enableEmailRecoveryModule,
        configureRecoveryAndRequestGuardian,
        requestRecovery,
        completeRecovery,
    }), [
        recoveryConfigs,
        getRecoveryConfig,
        setRecoveryConfig,
        isModuleEnabled,
        enableEmailRecoveryModule,
        configureRecoveryAndRequestGuardian,
        requestRecovery,
        completeRecovery,
    ])

    return (
        <appContextV2.Provider value={ctxVal}>
            {children}
        </appContextV2.Provider>
    )
}
