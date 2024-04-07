import styled from "styled-components";
import { ConnectKitButton } from "connectkit";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useWalletClient, useConfig } from "wagmi";
import { relayer } from "./services/relayer";
import {
  abi as moduleAbi,
  bytecode as moduleBytecode,
} from "./abi/SafeZkEmailRecoveryPlugin.json";
import {
  verifier,
  dkimRegistry,
  emailAuthImpl,
} from "./../contracts.base-sepolia.json";

// TODO Pull from lib
type HexStr = `0x${string}`;

const safeModuleAddressKey = "safeModuleAddress";

import { VStack, HStack } from "./components/Spacer/Stack";
import {
  PrimaryText,
  SecondaryText,
  TertiaryText,
} from "./components/core/Text";
import WalletIcon from "./icons/WalletIcon";
import InfoIcon from "./icons/InfoIcon";
import { SecondaryHeader } from "./components/core/Text";
import Card from "./components/Card";
import { useCallback, useMemo, useState } from "react";
import ConfigureAndStartRecoverySection from "./ConfigureAndStartRecoverySection";
import testPfp from "../src/assets/testPfp.png";
import { ConfigureSafeModule } from "./components/ConfigureSafeModule";
import { PerformRecovery } from "./components/PerformRecovery";
import { NewButton } from "./components/Button";

enum View {
  providerTest = "providerTest",
  firstStep = "firstStep",
  secondStep = "secondStep",
  thirdStep = "thirdStep",
}

const testWalletConnectionData = {
  ensName: "anaaronist.eth",
  walletAddress: "0x95e1...17d6",
};

export default function EmailRecovery() {
  const [currentView, setCurrentView] = useState<View>(View.firstStep);
  const [isExistingWallet, setIsExistingWallet] = useState<boolean>(false);

  const cfg = useConfig();
  const { data: walletClient } = useWalletClient();
  const [safeModuleAddress, _] = useState(
    localStorage.getItem(safeModuleAddressKey),
  );

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [recoveryConfigured, setRecoveryConfigured] = useState(false);

  // not sure where we need use this
  const deployEmailRecoveryModule = useCallback(async () => {
    const hash = (await walletClient?.deployContract({
      abi: moduleAbi,
      bytecode: moduleBytecode.object as HexStr,
      args: [verifier, dkimRegistry, emailAuthImpl],
    })) as HexStr;
    console.debug("module deploy txn hash", hash);
    const receipt = await waitForTransactionReceipt(cfg, { hash });
    console.debug("module deploy txn receipt", receipt);
    // TODO Look this up from receipt
    // const moduleAddress = "0x01";

    // setSafeModuleAddress(moduleAddress);
    // localStorage.setItem(safeModuleAddressKey, moduleAddress);
  }, [walletClient, cfg]);

  const enableEmailRecoveryModule = useCallback(async () => {
    // TODO submit txn to enable module

    setModuleEnabled(true);
  }, []);

  const handleEnableEmailRecoveryClick = useCallback(() => {
    setCurrentView(View.thirdStep);
    enableEmailRecoveryModule();
  }, [enableEmailRecoveryModule]);

  const configureRecoveryAndRequestGuardian = useCallback(async () => {
    // TODO submit txn/userop to configure recovery
    // TODO Consider, could we enable the module & configure recovery in one step/txn/userop?

    //   await relayer.acceptanceRequest();

    setRecoveryConfigured(true);
  }, []);

  const recoveryCfgEnabled = useMemo(
    () => !moduleEnabled || recoveryConfigured,
    [moduleEnabled, recoveryConfigured],
  );

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
              <Card compact={true}>
                <StyledSafeDetailsWrapper gap={8} align="center">
                  <img
                    src={testPfp}
                    width={24}
                    height={24}
                    alt="profilePictute"
                  />
                  <PrimaryText>{testWalletConnectionData.ensName}</PrimaryText>
                  <TertiaryText>
                    {testWalletConnectionData.walletAddress}
                  </TertiaryText>
                </StyledSafeDetailsWrapper>
              </Card>
            </HStack>
            <StyledWalletButton onClick={handleEnableEmailRecoveryClick}>
              <HStack gap={12}>Enable Email Recovery Module</HStack>
            </StyledWalletButton>
          </VStack>
        </>
      );
    } else if (currentView === View.thirdStep) {
      return (
        <ConfigureAndStartRecoverySection isExistingWallet={isExistingWallet} />
      );
    }

    // first (default) step
    return (
      <VStack gap={28} align="center">
        <SecondaryHeader>Email Recovery Demo</SecondaryHeader>
        <StyledWalletButton onClick={handleConnectGnosisSafeClick}>
          <HStack gap={12}>
            <WalletIcon />
            <>Connect Gnosis Safe</>
          </HStack>
        </StyledWalletButton>

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
  padding-top: 1000px;
`;

const StyledSafeDetailsWrapper = styled(HStack)`
  height: 32px;
`;

const UnderlinedText = styled.p`
  text-decoration: underline;

  &:hover {
    cursor: pointer;
  }
`;
