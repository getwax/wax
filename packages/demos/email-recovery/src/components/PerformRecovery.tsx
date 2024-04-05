import { waitForTransactionReceipt } from '@wagmi/core'
import { useState, useCallback } from 'react'
import { Button } from './Button'
import { relayer } from '../services/relayer'
import { useConfig, useWalletClient } from 'wagmi'
import { abi as proxyAbi, bytecode as proxyBytecode } from '../abi/ERC1967Proxy.json'
import { abi as simpleWalletAbi } from '../abi/SimpleWallet.json'
import {
    verifier,
    dkimRegistry,
    emailAuthImpl,
    simpleWalletImpl
} from '../../contracts.base-sepolia.json'
import { ethers } from 'ethers'

// TODO Pull from lib
type HexStr = `0x${string}`;

const simpleWalletAddressKey = 'simpleWalletAddress'

// Gen 32 byte rand hex (64 char)
// TODO spot check this to make sure done correctly
const genRandHex = () => {
    const randVals = new Uint32Array(8)
    crypto.getRandomValues(randVals)

    return [...randVals]
      .map((val) => val.toString(16).padStart(2, '0'))
      .join('')
}

// TODO Switch back to Safe over SimpleWallet
export function PerformRecovery() {
    const cfg = useConfig()
    const { data: walletClient } = useWalletClient()
    const [simpleWalletAddress, setSimpleWalletAddress] = useState(
        localStorage.getItem(simpleWalletAddressKey)
    )
    const [guardianEmail, setGuardianEmail] = useState<string>();
    // TODO TEST, probably don't show on FE
    const [accountCode, setAccountCode] = useState<string>();

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
        console.debug('simplewallet deploy txn hash', hash)
        const { contractAddress } = await waitForTransactionReceipt(cfg, { hash })
        if (!contractAddress) {
            throw new Error('simplewallet deployment has no contractAddress');
        }
        console.debug('simplewallet address ', contractAddress)

        setSimpleWalletAddress(contractAddress);
        localStorage.setItem(simpleWalletAddressKey, contractAddress);
    }, [walletClient, cfg])

    // TODO Pass in props or get from onchain data
    const [recoveryInProgress, setRecoveryInProgress] = useState(false);
    const [recoveryApproved, setRecoveryApproved] = useState(false);
    const [delayRemaining, setDelayRemaining] = useState(0);

    const requestGuardian = useCallback(async () => {
        const accountCode = genRandHex()
        const templateIdx = 0
        // TODO Update with safe module accept subject
        const subject = `Accept guardian request for ${simpleWalletAddress}`;

        if (!simpleWalletAddress) {
            throw new Error('simple wallet address not set')
        }

        if (!guardianEmail) {
            throw new Error('guardian email not set')
        }

        const resBody = await relayer.acceptanceRequest(
            simpleWalletAddress,
            guardianEmail,
            accountCode,
            templateIdx,
            subject
        );
        console.debug('acceptance request res body', resBody);

        setAccountCode(accountCode)
        setRecoveryInProgress(true)
    }, [simpleWalletAddress, guardianEmail])

    const requestRecovery = useCallback(async () => {
        // await relayer.recoveryRequest();
    
        setRecoveryInProgress(true);
    }, [])

    const testRecoveryApprove = useCallback(() => {
        // TODO Instead, poll relayer.requestStatus until approval is complete

        setRecoveryApproved(true);
        setDelayRemaining(42);
    }, []);

    const testTimeTravel = useCallback(() => {
        setDelayRemaining(0);
    }, []);

    const completeRecovery = useCallback(async () => {
        // TODO Instead, poll relayer.requestStatus until complete recovery is complete

        setRecoveryInProgress(false);
        setRecoveryApproved(false);
    }, []);

    return (
        <>
            <div>{`TEST SimplerWallet address: ${simpleWalletAddress}`}</div>
            <div>{`TEST account code: ${accountCode}`}</div>
            <Button disabled={!!simpleWalletAddress} onClick={deploySimpleWallet}>TEST Deploy SimpleWallet</Button>
            <div>
                <label>
                    Guardian's Email
                    <input disabled ={!simpleWalletAddress}
                        type='email'
                        onInput={e => setGuardianEmail(e.target.value)}
                    />
                </label>
                <Button
                    disabled={!simpleWalletAddress || !guardianEmail}
                    onClick={requestGuardian}>
                    TEST Request Guardian
                </Button>
            </div>
            <Button disabled={recoveryInProgress} onClick={requestRecovery}>
                3. Request Recovery
            </Button>
            <div>
                <div>4. Awaiting Guardian Approval</div>
                <Button disabled={recoveryApproved} onClick={testRecoveryApprove}>
                    TEST Approve (Switch to polling)
                </Button>
            </div>
            <div>
                <div>5. Waiting until delay is finished... ({delayRemaining} time units)</div>
                <Button
                    disabled={!recoveryInProgress || !recoveryApproved || !delayRemaining}
                    onClick={testTimeTravel}>
                    TEST Time Travel
                </Button>
            </div>
            <Button
                disabled={!recoveryInProgress || !recoveryApproved || !delayRemaining} 
                onClick={completeRecovery}>
                6. Complete Recovery (Switch to polling)
            </Button>
        </>
    );
}
