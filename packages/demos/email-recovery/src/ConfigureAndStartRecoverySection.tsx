import styled from "styled-components";
import { useMemo, useState } from "react";

import { VStack, HStack } from "./components/Spacer/Stack";
import { NewButton } from "./components/Button";
import {
  PrimaryText,
  SecondaryText,
  TertiaryText,
} from "./components/core/Text";
import Card from "./components/Card";
import Input from "./components/Input";

const testWalletConnectionData = {
  ensName: "anaaronist.eth",
  walletAddress: "0x95e1...17d6",
};

enum SubmitType {
  configureAndRequestGuardian = "configureAndRequestGuardian",
  startRecovery = "startRecovery",
  completeRecovery = "completeRecovery",
}

const testGuardianEmail = "guardian@prove.email";

export default function ConfigureAndStartRecoverySection() {
  const [progressState, setProgressState] = useState<SubmitType>(
    SubmitType.startRecovery,
  );
  const actionsComponent = useMemo(() => {
    if (progressState === SubmitType.startRecovery) {
      return (
        <>
          <ContentWrapper>
            <Card>
              <ContentWrapper gap={12}>
                <HStack>
                  <TertiaryText>Guardian's Email</TertiaryText>
                </HStack>

                <HStack justify="space-between" align="center">
                  <Input
                    placeholder="guardian email here"
                    defaultValue={testGuardianEmail}
                    type="email"
                    readOnly={true}
                    onChange={() => {}}
                  />
                  <TertiaryText>Recovery delay: 0</TertiaryText>
                </HStack>
              </ContentWrapper>
            </Card>
          </ContentWrapper>
          <StyledWalletButton active={false}>
            Configure Recovery and Request Guardian
          </StyledWalletButton>
        </>
      );
    }
  }, [progressState, testGuardianEmail]);

  return (
    <VStack gap={28} align="center">
      <Header>Safe Email Recovery Demo</Header>
      <ContentWrapper>
        <HStack>
          <SecondaryText>Connected Wallet: </SecondaryText>
        </HStack>
        <ContentWrapper>
          <StyledCard>
            <Card compact={true}>
              <HStack gap={8} align="center">
                <>pfp</>
                <PrimaryText>{testWalletConnectionData.ensName}</PrimaryText>
                <TertiaryText>
                  {testWalletConnectionData.walletAddress}
                </TertiaryText>
              </HStack>
            </Card>
          </StyledCard>
        </ContentWrapper>
      </ContentWrapper>
      {actionsComponent}
    </VStack>
  );
}

const StyledCard = styled.div`
  width: min-content;
`;

const ContentHWrapper = styled(HStack)`
  width: 100%;
`;

const ContentWrapper = styled(VStack)`
  width: 100%;
`;

const Header = styled.p`
  font-size: 36px;
  font-weight: 600;
  margin: 0;
`;

const StyledSafeDetailsWrapper = styled(HStack)`
  width: min-content;
  height: 32px;
`;

const StyledWalletButton = styled(NewButton)`
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 380px;
`;
