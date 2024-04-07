import { waitForTransactionReceipt } from '@wagmi/core'
import { useState, useCallback } from 'react'
import { Button } from './Button'
import { relayer } from '../services/relayer'
import { useConfig, useReadContract, useWalletClient } from 'wagmi'
import { abi as proxyAbi, bytecode as proxyBytecode } from '../abi/ERC1967Proxy.json'
import { abi as simpleWalletAbi } from '../abi/SimpleWallet.json'
import {
    verifier,
    dkimRegistry,
    emailAuthImpl,
    simpleWalletImpl
} from '../../contracts.base-sepolia.json'
import { ethers } from 'ethers'
import {
    genAccountCode,
    getRequestGuardianSubject,
    getRequestsRecoverySubject,
    templateIdx
} from '../utils/email'

// TODO Pull from lib
type HexStr = `0x${string}`;

const storageKeys = {
    simpleWalletAddress: 'simpleWalletAddress',
    guardianEmail: 'guardianEmail',
    accountCode: 'accountCode',
}

// TODO Switch back to Safe over SimpleWallet
export function PerformRecovery() {
    const cfg = useConfig()
    const { data: walletClient } = useWalletClient()
    const [simpleWalletAddress, setSimpleWalletAddress] = useState(
        localStorage.getItem(storageKeys.simpleWalletAddress)
    )
    const [guardianEmail, setGuardianEmail] = useState(
        localStorage.getItem(storageKeys.guardianEmail)
    );
    // TODO TEST, probably don't show on FE
    const [accountCode, setAccountCode] = useState(
        localStorage.getItem(storageKeys.accountCode)
    );
    const [gurdianRequestId, setGuardianRequestId] = useState<number>()
    const [newOwner, setNewOwner] = useState<string>()

    const { data: simpleWalletOwner } = useReadContract({
        address: simpleWalletAddress as HexStr,
        abi: simpleWalletAbi,
        functionName: 'owner',
    });

    const { data: timelock } = useReadContract({
        address: simpleWalletAddress as HexStr,
        abi: simpleWalletAbi,
        functionName: 'timelock',
    });

    const deploySimpleWallet = useCallback(async() => {
        const simpleWalletInterface = new ethers.Interface(simpleWalletAbi);
        const data = simpleWalletInterface.encodeFunctionData('initialize', [
            walletClient?.account.address, verifier, dkimRegistry, emailAuthImpl
        ]);

        const hash = await walletClient?.deployContract({
            abi: proxyAbi,
            bytecode: proxyBytecode.object as HexStr,
            args: [simpleWalletImpl, data],
        }) as HexStr
        const { contractAddress } = await waitForTransactionReceipt(cfg, { hash })
        if (!contractAddress) {
            throw new Error('simplewallet deployment has no contractAddress');
        }

        setSimpleWalletAddress(contractAddress);
        // localStorage.setItem(storageKeys.simpleWalletAddress, contractAddress);
    }, [walletClient, cfg])

    const requestGuardian = useCallback(async () => {
        if (!simpleWalletAddress) {
            throw new Error('simple wallet address not set')
        }

        if (!guardianEmail) {
            throw new Error('guardian email not set')
        }

        const accountCode = await genAccountCode()
        const subject = getRequestGuardianSubject(simpleWalletAddress);

        const { requestId } = await relayer.acceptanceRequest(
            simpleWalletAddress,
            guardianEmail,
            accountCode,
            templateIdx,
            subject,
        );

        setGuardianRequestId(requestId)

        setAccountCode(accountCode)
        // localStorage.setItem(storageKeys.accountCode, accountCode)
        // localStorage.setItem(storageKeys.guardianEmail, guardianEmail)
    }, [simpleWalletAddress, guardianEmail])

    const checkGuardianAcceptance = useCallback(async () => {
        if (!gurdianRequestId) {
            throw new Error('missing guardian request id')
        }

        const resBody = await relayer.requestStatus(gurdianRequestId)
        console.debug('guardian req res body', resBody);
    }, [gurdianRequestId])

    const requestRecovery = useCallback(async () => {
        if (!simpleWalletAddress) {
            throw new Error('simple wallet address not set')
        }

        if (!guardianEmail) {
            throw new Error('guardian email not set')
        }

        if (!newOwner) {
            throw new Error('new owner not set')
        }

        const subject = getRequestsRecoverySubject(simpleWalletAddress, newOwner)

        const { requestId } = await relayer.recoveryRequest(
            simpleWalletAddress,
            guardianEmail,
            templateIdx,
            subject,
        )
        console.debug('recovery request id', requestId)

    }, [simpleWalletAddress, guardianEmail, newOwner])

    const completeRecovery = useCallback(async () => {
        // TODO Instead, poll relayer.requestStatus until complete recovery is complete

    }, []);

    return (
        <>
            <div>{`TEST SimplerWallet address: ${simpleWalletAddress}`}</div>
            <div>{`TEST SimpleWallet owner ${simpleWalletOwner}`}</div>
            <div>{`TEST account code: ${accountCode}`}</div>
            <div>{`TEST timelock: ${timelock}`}</div>
            <Button disabled={!!simpleWalletAddress} onClick={deploySimpleWallet}>TEST Deploy SimpleWallet</Button>
            <div>
                <label>
                    Guardian's Email
                    <input disabled ={!simpleWalletAddress}
                        type='email'
                        onInput={e => setGuardianEmail((e.target as HTMLTextAreaElement).value)}
                    />
                </label>
                <Button
                    disabled={!simpleWalletAddress || !guardianEmail || !!gurdianRequestId}
                    onClick={requestGuardian}>
                    TEST Request Guardian
                </Button>
            </div>
            <div>
                <Button onClick={checkGuardianAcceptance}>
                    TEST Check for guardian acceptance
                </Button>
            </div>
                <label>
                    New Owner (address)
                    <input type='text'
                        onInput={e => setNewOwner((e.target as HTMLTextAreaElement).value)}
                    />
                </label>
            <Button onClick={requestRecovery}>
                3. Request Recovery
            </Button>
            <Button onClick={completeRecovery}>
                4. Complete Recovery (Switch to polling)
            </Button>
        </>
    );
}
