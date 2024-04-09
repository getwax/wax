import styled from "styled-components";
import { ConnectKitButton } from "connectkit";

import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { abi as safeAbi } from "./abi/Safe.json";
import { abi as recoveryPluginAbi } from "./abi/SafeZkEmailRecoveryPlugin.json";
import { safeZkSafeZkEmailRecoveryPlugin } from "./../contracts.base-sepolia.json";
import {
  genAccountCode,
  getRequestGuardianSubject,
  templateIdx,
} from "./utils/email";
import { readContract } from "wagmi/actions";
import { config } from "./providers/config";
import { pad } from "viem";
import { relayer } from "./services/relayer";

// TODO Pull from lib
type HexStr = `0x${string}`;

const safeModuleAddressKey = "safeModuleAddress";

import { VStack, HStack } from "./components/Spacer/Stack";
import { SecondaryText } from "./components/core/Text";
import WalletIcon from "./icons/WalletIcon";
import InfoIcon from "./icons/InfoIcon";
import { SecondaryHeader } from "./components/core/Text";
import { useCallback, useMemo, useState } from "react";
import ConfigureAndStartRecoverySection from "./ConfigureAndStartRecoverySection";
import { ConfigureSafeModule } from "./components/ConfigureSafeModule";
import { PerformRecovery } from "./components/PerformRecovery";
import { CustomConnectWalletButton, NewButton } from "./components/Button";

enum View {
  providerTest = "providerTest",
  firstStep = "firstStep",
  secondStep = "secondStep",
  thirdStep = "thirdStep",
}

export default function EmailRecovery() {
  // set currentView to default value View.firstStep to test flow
  const [currentView, setCurrentView] = useState<View>(View.providerTest);
  const [isExistingWallet, setIsExistingWallet] = useState<boolean>(false);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [recoveryConfigured, setRecoveryConfigured] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState<string>();
  // TODO 0 sets recovery to default of 2 weeks, likely want a warning here
  // Also, better time duration setting component
  const [recoveryDelay, setRecoveryDelay] = useState(0);

  const { data: isModuleEnabled } = useReadContract({
    address,
    abi: safeAbi,
    functionName: "isModuleEnabled",
    args: [safeZkSafeZkEmailRecoveryPlugin],
  });

  const { data: safeOwnersData } = useReadContract({
    address,
    abi: safeAbi,
    functionName: "getOwners",
  });
  const firstSafeOwner = useMemo(() => {
    const safeOwners = safeOwnersData as string[];
    if (!safeOwners?.length) {
      return;
    }
    return safeOwners[0];
  }, [safeOwnersData]);

  const enableEmailRecoveryModule = useCallback(async () => {
    if (!address) {
      throw new Error("unable to get account address");
    }

    await writeContractAsync({
      abi: safeAbi,
      address,
      functionName: "enableModule",
      args: [safeZkSafeZkEmailRecoveryPlugin],
    });
  }, [address, writeContractAsync]);

  const configureRecoveryAndRequestGuardian = useCallback(async () => {
    if (!address) {
      throw new Error("unable to get account address");
    }

    if (!guardianEmail) {
      throw new Error("guardian email not set");
    }

    if (!firstSafeOwner) {
      throw new Error("safe owner not found");
    }

    const accountCode = await genAccountCode();
    const guardianSalt = await relayer.getAccountSalt(
      accountCode,
      guardianEmail,
    );
    const guardianAddr = await readContract(config, {
      abi: recoveryPluginAbi,
      address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
      functionName: "computeEmailAuthAddress",
      args: [guardianSalt],
    });
    // TODO Should this be something else?
    const previousOwnerInLinkedList = pad("0x1", {
      size: 20,
    });

    await writeContractAsync({
      abi: recoveryPluginAbi,
      address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
      functionName: "configureRecovery",
      args: [
        firstSafeOwner,
        guardianAddr,
        recoveryDelay,
        previousOwnerInLinkedList,
      ],
    });

    console.debug("recovery configured");

    const recoveryRelayerAddr = (await readContract(config, {
      abi: recoveryPluginAbi,
      address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
      functionName: "getRouterForSafe",
      args: [address],
    })) as string;

    const subject = getRequestGuardianSubject(address);
    const { requestId } = await relayer.acceptanceRequest(
      recoveryRelayerAddr,
      guardianEmail,
      accountCode,
      templateIdx,
      subject,
    );

    console.debug("req guard req id", requestId);

    setRecoveryConfigured(true);
  }, [
    address,
    firstSafeOwner,
    guardianEmail,
    recoveryDelay,
    writeContractAsync,
  ]);

  const recoveryCfgEnabled = useMemo(
    () => !isModuleEnabled || recoveryConfigured,
    [isModuleEnabled, recoveryConfigured],
  );

  const handleEnableEmailRecoveryClick = useCallback(() => {
    setCurrentView(View.thirdStep);
    enableEmailRecoveryModule();
  }, [enableEmailRecoveryModule]);

  const handleConnectGnosisSafeClick = useCallback(() => {
    setCurrentView(View.secondStep);
  }, []);

  const handleRecoverExistingWalletClick = useCallback(() => {
    setIsExistingWallet(true);
    setCurrentView(View.thirdStep);
  }, []);

  const inner = useMemo(() => {
    if (currentView === View.providerTest) {
      return (
        <ControlsAndExistingUI>
          <>
            <ConnectKitButton />
            <ConfigureSafeModule />
          </>
          <PerformRecovery />
        </ControlsAndExistingUI>
      );
    } else if (currentView === View.secondStep) {
      return (
        <>
          <SecondaryHeader>Safe Email Recovery Demo</SecondaryHeader>

          <VStack gap={20} align="center">
            <HStack gap={12} align="center">
              <SecondaryText>Connected Wallet: </SecondaryText>
              <CustomConnectWalletButton />
            </HStack>
            <StyledWalletButton onClick={handleEnableEmailRecoveryClick}>
              <HStack gap={12}>Enable Email Recovery Module</HStack>
            </StyledWalletButton>
          </VStack>
        </>
      );
    } else if (currentView === View.thirdStep) {
      return (
        <ConfigureAndStartRecoverySection
          onConfigureRecoveryAndRequestGuardianClick={
            configureRecoveryAndRequestGuardian
          }
          isExistingWallet={isExistingWallet}
        />
      );
    }

    // first (default) step
    return (
      <VStack gap={28} align="center">
        <SecondaryHeader>Email Recovery Demo</SecondaryHeader>
        <CustomConnectWalletButton
          buttonLabel="Connect Gnosis Safe"
          onConnect={handleConnectGnosisSafeClick}
        />

        <HStack gap={8}>
          <InfoIcon /> <>Copy the link and import into your Safe wallet</>
        </HStack>
        <StyledWalletButton active={false}>
          <HStack gap={12}>
            <WalletIcon />
            Connect Test Wallet
          </HStack>
        </StyledWalletButton>
        <div onClick={handleRecoverExistingWalletClick}>
          <UnderlinedText>Or, recover existing wallet instead</UnderlinedText>
        </div>
      </VStack>
    );
  }, [
    handleEnableEmailRecoveryClick,
    handleConnectGnosisSafeClick,
    currentView,
  ]);

  return <>{inner}</>;
}

const StyledWalletButton = styled(NewButton)`
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 380px;
`;

const ControlsAndExistingUI = styled.div`
  padding-top: 0px;
`;

const UnderlinedText = styled.p`
  text-decoration: underline;

  &:hover {
    cursor: pointer;
  }
`;
