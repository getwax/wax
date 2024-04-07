import { ConnectKitButton } from "connectkit";
import styled from "styled-components";

import "./App.css";
import { ConfigureSafeModule } from "./components/ConfigureSafeModule";
import { PerformRecovery } from "./components/PerformRecovery";
import { Web3Provider } from "./providers/Web3Provider";
import { NewButton } from "./components/Button";
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

const testGuardianEmail = "guardian@prove.email";

function App() {
  const [currentView, setCurrentView] = useState<View>(View.firstStep);
  const [isExistingWallet, setIsExistingWallet] = useState<boolean>(false);

  const handleConnectGnosisSafeClick = useCallback(() => {
    setCurrentView(View.secondStep);
  }, []);

  const handleEnableEmailRecoveryClick = useCallback(() => {
    setCurrentView(View.thirdStep);
  }, []);

  const handleRecoverExistingWalletClick = () => {
    setIsExistingWallet(true);
    setCurrentView(View.thirdStep);
  };

  const inner = useMemo(() => {
    if (currentView === "providerTest") {
      return (
        <ControlsAndExistingUI>
          <Web3Provider>
            <>
              <ConnectKitButton />
              <ConfigureSafeModule />
            </>
            <PerformRecovery />
          </Web3Provider>
        </ControlsAndExistingUI>
      );
    } else if (currentView === "secondStep") {
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
    } else if (currentView === "thirdStep") {
      return (
        <ConfigureAndStartRecoverySection isExistingWallet={isExistingWallet} />
      );
    }

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

  return <PageWrapper justify="center">{inner}</PageWrapper>;
}

export default App;

const PageWrapper = styled(VStack)`
  background-color: #0c111d;
  width: 100%;
  height: 100%;
  color: white;
`;

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
