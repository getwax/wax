import { ChangeEventHandler, HTMLInputTypeAttribute } from "react";
import styled from "styled-components";

type InputProps = {
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  defaultValue?: string;
  errorMessage?: string;
  readOnly?: boolean;
  type?: HTMLInputTypeAttribute;
};

export default function Input({
  placeholder,
  defaultValue,
  readOnly,
  errorMessage,
  type,
  onChange,
}: InputProps) {
  return (
    <StyledInput
      placeholder={placeholder}
      defaultValue={defaultValue}
      onChange={onChange}
      type={type}
      readOnly={readOnly}
    />
  );
}

const StyledInput = styled.input`
  background-color: #1f242f;
  border: 1px solid #333741;
  color: #85888e;
  font-size: 16px;
  border-radius: 8px;

  padding-left: 12px;
  padding-right: 12px;
  padding-top: 6px;
  padding-bottom: 6px;
`;
