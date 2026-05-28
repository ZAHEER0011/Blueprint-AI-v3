import React from "react";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950">{children}</div>
}

export default AuthLayout