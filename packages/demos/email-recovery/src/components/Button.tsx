import React, { ReactNode } from "react";

type ButtonProps = {
  endIcon?: ReactNode;
  loading?: boolean;
} & React.ComponentPropsWithoutRef<"button">;

export function Button({ children, ...buttonProps }: ButtonProps) {
  return (
    <div className="button">
      <button {...buttonProps}>
        {children}
        {buttonProps?.endIcon ? buttonProps?.endIcon : null}
        {buttonProps?.loading ? <div className="loader" /> : null}
      </button>
    </div>
  );
}
