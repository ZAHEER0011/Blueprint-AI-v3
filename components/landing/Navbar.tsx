import Link from "next/link";
import { Button } from "../ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function Navbar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/40 backdrop-blur-md">
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link
                    href="/"
                    className="flex items-center text-lg font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
                >
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Web</span>
                    <span className="text-white">Craft</span>
                </Link>

                <div className="flex items-center gap-3">
                    <SignedOut>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-xs"
                            asChild
                        >
                            <Link href="/sign-in">Log in</Link>
                        </Button>

                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-95 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 text-xs border-0"
                            asChild
                        >
                            <Link href="/sign-up">Get started</Link>
                        </Button>
                    </SignedOut>

                    <SignedIn>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-95 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 text-xs border-0"
                            asChild
                        >
                            <Link href="/dashboard">Dashboard</Link>
                        </Button>
                    </SignedIn>
                </div>
            </nav>
        </header>
    );
}