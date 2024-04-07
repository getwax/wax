import { PropsWithChildren } from "react";
import styled from "styled-components";

export function PrimaryText({ children }: PropsWithChildren) {
  return <StyledPrimaryText>{children}</StyledPrimaryText>;
}

export function SecondaryText({ children }: PropsWithChildren) {
  return <StyledSecondaryText>{children}</StyledSecondaryText>;
}

export function TertiaryText({ children }: PropsWithChildren) {
  return <StyledTertiaryText>{children}</StyledTertiaryText>;
}

const StyledPrimaryText = styled.p`
  color: white;
  line-height: 10px;
`;

const StyledSecondaryText = styled.p`
  font-size: 16px;
  color: #cecfd2;
  line-height: 10px;
`;

const StyledTertiaryText = styled.span`
  color: #94969c;
  line-height: 10px;
`;
