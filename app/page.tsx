import { Hero, Navbar } from "@/components/landing";
import React from "react";

const LandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Navbar />
      <Hero />
    </div>
  )
}

export default LandingPage