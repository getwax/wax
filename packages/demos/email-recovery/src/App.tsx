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
import { useMemo } from "react";

function App() {
  const providerTest = false;
  const secondStep = true;

  const inner = useMemo(() => {
    if (providerTest) {
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
    } else if (secondStep) {
      return (
        <>
          <Header>Safe Email Recovery Demo</Header>

          <VStack gap={20} align="center">
            <HStack gap={12}>
              <StyledText>Connected Wallet:</StyledText>
            </HStack>
            <StyledWalletButton active={false}>
              <HStack gap={12}>Enable email recovery module</HStack>
            </StyledWalletButton>
          </VStack>
        </>
      );
    }
    return (
      <VStack gap={28} align="center">
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
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 312px;
`;

const ControlsAndExistingUI = styled.div`
  padding-top: 1000px;
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

const StyledText = styled.p`
  font-size: 16px;
  color: #cecfd2;
`;
