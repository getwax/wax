import React from "react";

export function Button({
  children,
  ...buttonProps
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <div className="button">
      <button {...buttonProps}>
        {children}
        {buttonProps.endIcon ? buttonProps.endIcon : null}
        {buttonProps?.loading ? <div className="loader" /> : null}
      </button>
    </div>
  );
}
