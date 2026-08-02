import { Hero1 } from "@/components/hero";
import { Navbar1 } from "@/components/navbar"
import { Footer2 } from "@/components/footer2"
import { Cta39 } from "@/components/cta"
import { Pricing2 } from "@/components/pricing";
import { Feature73 } from "@/components/feature";

export default function LandingPage(){
  return(
    <main>  
      <Navbar1/>
      <Hero1 />
      <Feature73 />
      <Pricing2 />
      <Cta39 />
      <Footer2/>
    </main>
  )
}