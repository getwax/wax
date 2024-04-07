import { ConnectKitButton } from "connectkit";
import styled from "styled-components";

import "./App.css";
import { ConfigureSafeModule } from "./components/ConfigureSafeModule";
import { PerformRecovery } from "./components/PerformRecovery";
import { Web3Provider } from "./providers/Web3Provider";
import { NewButton } from "./components/Button";
import { VStack, HStack } from "./components/Spacer/Stack";
import WalletIcon from "./icons/WalletIcon";
import InfoIcon from "./icons/InfoIcon";
import Input from "./components/Input";
import Card from "./components/Card";
import { useMemo, useState } from "react";

type View = "providerTest" | "firstStep" | "secondStep" | "thirdStep";

const testWalletConnectionData = {
  ensName: "anaaronist.eth",
  walletAddress: "0x95e1...17d6",
};

function App() {
  const [currentView, _] = useState<View>("thirdStep" as View);

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
          <Header>Safe Email Recovery Demo</Header>

          <VStack gap={20} align="center">
            <HStack gap={12}>
              <SecondaryText>Connected Wallet: </SecondaryText>
              <Card>
                <StyledSafeDetailsWrapper gap={8} align="center">
                  <>pfp</>
                  <PrimaryText>{testWalletConnectionData.ensName}</PrimaryText>
                  <TertiaryText>
                    {testWalletConnectionData.walletAddress}
                  </TertiaryText>
                </StyledSafeDetailsWrapper>
              </Card>
            </HStack>
            <StyledWalletButton active={false}>
              <HStack gap={12}>Enable Email Recovery Module</HStack>
            </StyledWalletButton>
          </VStack>
        </>
      );
    } else if (currentView === "thirdStep") {
      return (
        <VStack gap={28} align="center">
          <Header>Safe Email Recovery Demo</Header>
          <VStack>
            <HStack>
              <SecondaryText>Connected Wallet: </SecondaryText>
            </HStack>
            <Card>
              <StyledSafeDetailsWrapper gap={8} align="center">
                <>pfp</>
                <PrimaryText>{testWalletConnectionData.ensName}</PrimaryText>
                <TertiaryText>
                  {testWalletConnectionData.walletAddress}
                </TertiaryText>
              </StyledSafeDetailsWrapper>
            </Card>
          </VStack>
          <Card>
            <VStack>
              <HStack>
                <TertiaryText>Guardian's Email</TertiaryText>
              </HStack>
              <Input name="Guardian Email" />
            </VStack>
          </Card>
          <StyledWalletButton active={false}>
            Configure Recovery and Request Guardian
          </StyledWalletButton>
        </VStack>
      );
    }

    return (
      <VStack gap={28} align="center">
        <Header>Email Recovery Demo</Header>
        <StyledWalletButton active={false}>
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
        <UnderlinedText>Or, recover existing wallet instead</UnderlinedText>
      </VStack>
    );
  }, []);

  return <PageWrapper justify="center">{inner}</PageWrapper>;
}

export default App;

const PageWrapper = styled(VStack)`
  background-color: #0c111d;
  width: 100%;
  height: 100%;
  color: white;
`;

const ContentWrapper = styled.div``;

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

const Header = styled.p`
  font-size: 36px;
  font-weight: 600;
  margin: 0;
`;

const UnderlinedText = styled.p`
  text-decoration: underline;

  &:hover {
    cursor: pointer;
  }
`;

const PrimaryText = styled.p`
  color: white;
`;

const SecondaryText = styled.p`
  font-size: 16px;
  color: #cecfd2;
`;

const TertiaryText = styled.span`
  color: #94969c;
`;
