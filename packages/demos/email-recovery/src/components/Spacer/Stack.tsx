import styled, { css, CSSProperties } from "styled-components";

/**
 * Horizontally stacked items with space between them
 */
export const HStack = styled.div<{
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  grow?: boolean;
  shrink?: boolean;
  inline?: boolean;
  wrap?: CSSProperties["flexWrap"];
}>`
  display: ${({ inline }) => (inline ? "inline-flex" : "flex")};
  gap: 0 ${({ gap }) => gap ?? 0}px;

  align-items: ${({ align }) => align ?? "unset"};
  justify-content: ${({ justify }) => justify ?? "unset"};

  flex-grow: ${({ grow }) => (grow ? "1" : "unset")};

  flex-wrap: ${({ wrap }) => wrap ?? "unset"};

  ${({ shrink }) =>
    shrink &&
    css`
      flex-shrink: 1;
      min-width: 0;
    `}
`;

/**
 * Vertically stacked items with space between them
 */
export const VStack = styled.div<{
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  grow?: boolean;
  shrink?: boolean;
  inline?: boolean;
  wrap?: CSSProperties["flexWrap"];
}>`
  display: ${({ inline }) => (inline ? "inline-flex" : "flex")};
  flex-direction: column;

  gap: ${({ gap }) => gap ?? 0}px 0;

  align-items: ${({ align }) => align ?? "unset"};
  justify-content: ${({ justify }) => justify ?? "unset"};

  flex-grow: ${({ grow }) => (grow ? "1" : "unset")};

  flex-wrap: ${({ wrap }) => wrap ?? "unset"};

  ${({ shrink }) =>
    shrink &&
    css`
      flex-shrink: 1;
      min-width: 0;
    `}
`;

/**
 * Fills the remaining space of the flex layout
 */
export const Spacer = styled.div`
  flex-grow: 1;
`;
