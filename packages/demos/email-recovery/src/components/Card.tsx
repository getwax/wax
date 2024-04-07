import { PropsWithChildren } from "react";
import styled from "styled-components";

type CardProps = {
  compact?: boolean;
} & PropsWithChildren;

export default function Card({ compact = false, children }: CardProps) {
  return <Wrapper compact={compact}>{children}</Wrapper>;
}

const Wrapper = styled.div<{ compact: boolean }>`
  display: flex;
  padding: ${({ compact }) => (compact ? "12" : "22")}px;
  border-radius: 8px;

  background-color: #161b26;
  border: 1px solid #333741;
`;
