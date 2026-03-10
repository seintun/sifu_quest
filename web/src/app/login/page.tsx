import { auth } from "@/auth"
import { DOMAIN_COLORS } from "@/lib/theme"
import { BookOpen, Compass, Shield } from "lucide-react"
import { redirect } from "next/navigation"
import { AuthForm } from "./AuthForm"

export default async function LoginPage() {
  const session = await auth()
  
  if (session?.user?.id) {
    redirect("/")
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
          style={{ background: DOMAIN_COLORS.dsa.hex }}
        />
        <div 
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
          style={{ background: DOMAIN_COLORS.streak.hex, animationDelay: "2s" }}
        />
        <div 
          className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-15"
          style={{ background: DOMAIN_COLORS.plan.hex }}
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[60px]" />
      </div>

      <div className="w-full max-w-[1000px] z-10 grid md:grid-cols-2 gap-12 items-center">
        {/* Left Side - Brand & Value Prop */}
        <div className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border/50 text-xs font-medium text-muted-foreground mb-6">
              <span className="w-2 h-2 rounded-full bg-streak animate-pulse" />
              Your path to mastery
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold tracking-tight text-foreground">
              Sifu Quest
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-md leading-relaxed">
              The AI-powered career coaching dashboard that treats your job search like an RPG. Track, learn, and level up.
            </p>
          </div>

          <div className="space-y-6 pt-4">
            <Feature
              icon={Compass}
              title="Interactive Mastery"
              description="Learn DSA and System Design with structured roadmaps and spaced repetition."
              color={DOMAIN_COLORS.dsa}
            />
            <Feature
              icon={BookOpen}
              title="AI Coaching"
              description="Your personal Claude coach to review patterns and mock interviews."
              color={DOMAIN_COLORS.coach}
            />
            <Feature
              icon={Shield}
              title="Private by Design"
              description="Everything stays on your machine in markdown files. No cloud lock-in."
              color={DOMAIN_COLORS.streak}
            />
          </div>
        </div>

        {/* Right Side - Auth Card */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[400px] rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-xl p-8 shadow-2xl relative">
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-foreground/10 to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to continue your journey</p>
              </div>

              <AuthForm />
              
              <p className="text-center text-xs text-muted-foreground mt-6">
                By continuing, you trust Sifu Quest with your career progression data. (Locally, of course.)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title, description, color }: any) {
  return (
    <div className="flex gap-4 items-start group">
      <div 
        className="shrink-0 p-2.5 rounded-xl border transition-colors duration-300"
        style={{ 
          backgroundColor: `${color.hex}15`, 
          borderColor: `${color.hex}30`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color: color.hex }} />
      </div>
      <div>
        <h3 className="font-medium text-foreground group-hover:text-foreground/90 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}
