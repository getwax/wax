import styled from "styled-components";
import { useMemo, useState } from "react";

import { VStack, HStack } from "./components/Spacer/Stack";
import {
  SecondaryText,
  TertiaryText,
  SecondaryHeader,
} from "./components/core/Text";
import { NewButton } from "./components/Button";
import Card from "./components/Card";
import Input from "./components/Input";
import SafeIcon from "../src/icons/SafeIcon";

const testGuardianEmail = "guardian@prove.email";
const testRequestWalletAddress = "0x.....";

enum ExistingWalletSubmitType {
  triggerRecoveryConfirmation = "triggerRecoveryConfirmation",
  completeRecovery = "completeRecovery",
}

type ExistingWalletStartRecoverySectionProps = {
  onProceed: () => void;
};

export default function ExistingWalletStartRecoverySection({
  onProceed,
}: ExistingWalletStartRecoverySectionProps) {
  const [existingWalletProgressState, setExistingWalletProgressState] =
    useState<ExistingWalletSubmitType>(
      ExistingWalletSubmitType.triggerRecoveryConfirmation,
    );

  const handleTriggerRecoveryConfirmation = () => {
    setExistingWalletProgressState(ExistingWalletSubmitType.completeRecovery);
  };

  const inner = useMemo(() => {
    if (
      existingWalletProgressState == ExistingWalletSubmitType.completeRecovery
    ) {
      return (
        <>
          <ContentWrapper gap={12}>
            <HStack>
              <SecondaryText>Recovery Status:</SecondaryText>
            </HStack>
            <Card>
              <ContentWrapper gap={12}>
                <GridWrapper>
                  <HStack>
                    <TertiaryText>Guardian's Email</TertiaryText>
                  </HStack>
                  <HStack>
                    <StyledTertiaryText>
                      Previouw Wallet Address
                    </StyledTertiaryText>
                  </HStack>

                  <Input
                    placeholder="guardian's email here"
                    defaultValue={testGuardianEmail}
                    type="email"
                    readOnly={false}
                    onChange={() => {}}
                  />
                  <Input
                    placeholder="requested new wallet address"
                    defaultValue={testRequestWalletAddress}
                    type="text"
                    readOnly={false}
                    onChange={() => {}}
                  />
                </GridWrapper>
              </ContentWrapper>
            </Card>

            <VStack align="center">
              <StyledWalletButton onClick={onProceed}>
                <HStack gap={4}>
                  <SafeIcon />
                  Complete Recovery
                </HStack>
              </StyledWalletButton>
            </VStack>
          </ContentWrapper>
        </>
      );
    }

    return (
      <>
        <ContentWrapper gap={12}>
          <HStack>
            <SecondaryText>Trigger Account Recovery:</SecondaryText>
          </HStack>
          <Card>
            <ContentWrapper gap={12}>
              <TriggerGridWrapper>
                <HStack>
                  <TertiaryText>Guardian's Email</TertiaryText>
                </HStack>
                <HStack>
                  <StyledTertiaryText>
                    Requested New Wallet Address
                  </StyledTertiaryText>
                </HStack>

                <HStack>
                  <StyledTertiaryText>New Wallet Address</StyledTertiaryText>
                </HStack>
                <Input
                  placeholder="guardian email here"
                  defaultValue={testGuardianEmail}
                  type="email"
                  readOnly={false}
                  onChange={() => {}}
                />
                <Input
                  placeholder="request wallet address here"
                  defaultValue={testRequestWalletAddress}
                  type="text"
                  readOnly={false}
                  onChange={() => {}}
                />
                <Input
                  placeholder="new wallet address"
                  defaultValue={testRequestWalletAddress}
                  type="text"
                  readOnly={false}
                  onChange={() => {}}
                />
              </TriggerGridWrapper>
            </ContentWrapper>
          </Card>
          <VStack align="center">
            <StyledWalletButton onClick={handleTriggerRecoveryConfirmation}>
              Trigger Recovery Confirmation
            </StyledWalletButton>
          </VStack>
        </ContentWrapper>
      </>
    );
  }, [
    handleTriggerRecoveryConfirmation,
    existingWalletProgressState,
    onProceed,
  ]);

  return (
    <VStack gap={28} align="center">
      <SecondaryHeader>Safe Email Recovery Demo</SecondaryHeader>
      {inner}
    </VStack>
  );
}

const RowWrapper = styled(HStack)`
  display: flex;
  width: 100%;
`;

const ContentWrapper = styled(VStack)`
  width: 100%;
`;

const TriggerGridWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 33%);
  grid-row-gap: 10px;
  grid-column-gap: 10px;
  width: 100%;
  justify-content: center;
  align-items: start;
`;

const GridWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 48%);
  grid-row-gap: 10px;
  grid-column-gap: 10px;
  width: 100%;
  justify-content: center;
  align-items: start;
`;

const StyledTertiaryText = styled(TertiaryText)`
  font-size: 14px;
  display: flex;
`;

const StyledWalletButton = styled(NewButton)`
  justify-content: center;
  align-items: center;
  height: 60px;
  max-width: 380px;
`;
