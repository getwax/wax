import React from 'react';

export function Button({ children, ...buttonProps }: React.ComponentPropsWithoutRef<"button">) {
    return (
        <div className="card">
            <button {...buttonProps}>
                {children}
            </button>
        </div>
    )
}
